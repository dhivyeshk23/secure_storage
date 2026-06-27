const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const CryptoService = require('../services/cryptoService');
const AuditService = require('../services/auditService');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = process.env.SUPABASE_BUCKET || 'secure_vault_encrypted_files';

exports.getUserFiles = async (req, res) => {
  const userId = req.user.id;
  try {
    const files = await prisma.file.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' }
    });

    const userUsage = await prisma.file.aggregate({
      where: { ownerId: userId },
      _sum: { fileSize: true }
    });
    
    let quota = await prisma.storageQuota.findUnique({ where: { userId } });
    if (!quota) {
      quota = await prisma.storageQuota.create({
        data: { userId, limitBytes: 104857600n }
      });
    }

    // Convert BigInts to strings for JSON
    const parsedFiles = files.map(f => ({ ...f, fileSize: f.fileSize.toString() }));

    res.json({
      files: parsedFiles,
      usage: {
        used: (userUsage._sum.fileSize || 0n).toString(),
        limit: quota.limitBytes.toString()
      }
    });
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

exports.uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const { originalname, size, path: tempPath } = req.file;
  const userId = req.user.id;
  let encryptedFilePath;

  try {
    // 1. Check Quota
    const userUsage = await prisma.file.aggregate({
      where: { ownerId: userId },
      _sum: { fileSize: true }
    });
    
    const usedBytes = userUsage._sum.fileSize || 0n;
    
    let quota = await prisma.storageQuota.findUnique({ where: { userId } });
    if (!quota) {
      // Default to 100MB if not set
      quota = await prisma.storageQuota.create({
        data: { userId, limitBytes: 104857600n }
      });
    }

    if (usedBytes + BigInt(size) > quota.limitBytes) {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return res.status(403).json({ error: 'Storage quota exceeded' });
    }
    // 2. Generate FEK and IV
    const fek = CryptoService.generateFEK();
    const iv = crypto.randomBytes(CryptoService.IV_LENGTH);

    // 3. Encrypt FEK with User's Public Key
    const encryptedFEK = CryptoService.encryptFEK(fek, req.user.publicKey);

    // 4. Setup Streaming Encryption
    const storedFilename = uuidv4() + '.enc';
    encryptedFilePath = path.join(__dirname, '../uploads', storedFilename);
    
    const readStream = fs.createReadStream(tempPath);
    const writeStream = fs.createWriteStream(encryptedFilePath);
    const cipher = crypto.createCipheriv(CryptoService.ALGORITHM, fek, iv);

    const hash = crypto.createHash('sha256');

    readStream.on('data', (chunk) => {
      hash.update(chunk);
    });

    // Write IV first, then encrypted data, then auth tag
    writeStream.write(iv);
    
    await new Promise((resolve, reject) => {
      readStream.pipe(cipher).pipe(writeStream, { end: false });
      cipher.on('end', () => {
        const authTag = cipher.getAuthTag();
        writeStream.end(authTag);
        resolve();
      });
      cipher.on('error', reject);
    });

    const checksum = hash.digest('hex');

    // 5. Upload encrypted file to Supabase
    const encryptedFileBuffer = fs.readFileSync(encryptedFilePath);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storedFilename, encryptedFileBuffer, {
        contentType: 'application/octet-stream',
      });

    if (uploadError) throw uploadError;

    // 6. Save Metadata to PostgreSQL
    const fileRecord = await prisma.file.create({
      data: {
        ownerId: userId,
        originalFilename: originalname,
        storedFilename,
        fileSize: size,
        checksum,
        storagePath: uploadData.path
      }
    });

    await prisma.encryptedKey.create({
      data: {
        fileId: fileRecord.id,
        userId: userId,
        encryptedFEK
      }
    });

    // Clean up temp files
    fs.unlinkSync(tempPath);
    fs.unlinkSync(encryptedFilePath);

    await AuditService.logEvent({
      userId,
      action: 'Upload',
      targetFile: fileRecord.id,
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: req.headers['user-agent']
    });

    res.json({ message: 'File uploaded securely', fileId: fileRecord.id });
  } catch (error) {
    req.logger?.error(error);
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (encryptedFilePath && fs.existsSync(encryptedFilePath)) fs.unlinkSync(encryptedFilePath);
    res.status(500).json({ error: 'Encryption or upload failed' });
  }
};

exports.shareFile = async (req, res) => {
  const { fileId, recipientEmail, permission } = req.body;
  const ownerId = req.user.id;
  const password = req.body.password; // Needed to decrypt owner's private key

  try {
    // 1. Get file and check ownership
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== ownerId) return res.status(403).json({ error: 'Unauthorized' });

    // 2. Get recipient
    const recipient = await prisma.user.findUnique({ where: { email: recipientEmail } });
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    // 3. Get owner's encrypted FEK
    const ownerKeyRecord = await prisma.encryptedKey.findUnique({
      where: { fileId_userId: { fileId, userId: ownerId } }
    });

    // 4. Decrypt owner's private key
    // For this simulation, we'll assume the user provides their password for sharing operations.
    const decryptedOwnerPrivateKey = CryptoService.decryptPrivateKey(
      req.user.encryptedPrivateKey, 
      password, 
      req.user.salt
    );

    // 5. Decrypt FEK
    const fek = CryptoService.decryptFEK(ownerKeyRecord.encryptedFEK, decryptedOwnerPrivateKey);

    // 6. Re-encrypt FEK with recipient's public key
    const encryptedFEKForRecipient = CryptoService.encryptFEK(fek, recipient.publicKey);

    // 7. Store new EncryptedKey and Share record
    await prisma.encryptedKey.create({
      data: {
        fileId,
        userId: recipient.id,
        encryptedFEK: encryptedFEKForRecipient
      }
    });

    await prisma.share.create({
      data: {
        fileId,
        recipientId: recipient.id,
        permission: permission || 'VIEW_ONLY'
      }
    });

    await AuditService.logEvent({
      userId: ownerId,
      action: 'Share',
      targetFile: fileId,
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: req.headers['user-agent']
    });

    res.json({ message: 'File shared successfully' });
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Sharing failed' });
  }
};

exports.downloadFile = async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.id;
  const password = req.headers['x-vault-password']; // User must supply password to decrypt their private key

  if (!password) {
    return res.status(400).json({ error: 'Password is required to decrypt files' });
  }

  try {
    // 1. Get the file metadata
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    // 2. Check access: user must be owner or have a share
    const isOwner = file.ownerId === userId;
    if (!isOwner) {
      const share = await prisma.share.findFirst({
        where: { fileId, recipientId: userId, status: 'ACTIVE', permission: { in: ['DOWNLOAD', 'VIEW_AND_DOWNLOAD'] } }
      });
      if (!share) return res.status(403).json({ error: 'You do not have download access to this file' });
    }

    // 3. Get the user's encrypted FEK for this file
    const keyRecord = await prisma.encryptedKey.findUnique({
      where: { fileId_userId: { fileId, userId } }
    });
    if (!keyRecord) return res.status(403).json({ error: 'No decryption key available for this file' });

    // 4. Decrypt the user's private key with their password
    const decryptedPrivateKey = CryptoService.decryptPrivateKey(
      req.user.encryptedPrivateKey,
      password,
      req.user.salt
    );

    // 5. Decrypt the FEK using the private key
    const fek = CryptoService.decryptFEK(keyRecord.encryptedFEK, decryptedPrivateKey);

    // 6. Download the encrypted file from Supabase
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(file.storedFilename);

    if (downloadError) throw downloadError;

    const encryptedBuffer = Buffer.from(await downloadData.arrayBuffer());

    // 7. Parse IV (first 12 bytes), then ciphertext, then auth tag (last 16 bytes)
    const iv = encryptedBuffer.subarray(0, CryptoService.IV_LENGTH);
    const authTag = encryptedBuffer.subarray(encryptedBuffer.length - CryptoService.AUTH_TAG_LENGTH);
    const ciphertext = encryptedBuffer.subarray(CryptoService.IV_LENGTH, encryptedBuffer.length - CryptoService.AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(CryptoService.ALGORITHM, fek, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // 8. Audit
    await AuditService.logEvent({
      userId,
      action: 'Download',
      targetFile: fileId,
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: req.headers['user-agent']
    });

    // 9. Send the decrypted file
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalFilename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.send(decryptedBuffer);
  } catch (error) {
    req.logger?.error(error);
    if (error.message?.includes('Decryption failed') || error.message?.includes('Unsupported state')) {
      return res.status(401).json({ error: 'Incorrect password — decryption failed' });
    }
    res.status(500).json({ error: 'Download failed' });
  }
};

exports.deleteFile = async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.id;

  try {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.ownerId !== userId) return res.status(403).json({ error: 'You can only delete your own files' });

    // 1. Delete from Supabase storage
    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove([file.storedFilename]);

    if (deleteError) req.logger?.error('Supabase delete error:', deleteError);

    // 2. Delete from database (cascades will remove EncryptedKey + Share records)
    await prisma.file.delete({ where: { id: fileId } });

    // 3. Audit
    await AuditService.logEvent({
      userId,
      action: 'Delete',
      targetFile: fileId,
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: req.headers['user-agent']
    });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Delete failed' });
  }
};
