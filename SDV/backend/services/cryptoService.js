const crypto = require('crypto');

class CryptoService {
  // AES-256-GCM details
  static ALGORITHM = 'aes-256-gcm';
  static IV_LENGTH = 12;
  static AUTH_TAG_LENGTH = 16;
  static KEY_LENGTH = 32;

  // PBKDF2 details
  static PBKDF2_ITERATIONS = 100000;
  static PBKDF2_KEY_LEN = 32;
  static PBKDF2_DIGEST = 'sha256';

  /**
   * Generate RSA-4096 key pair
   * @returns {Object} { publicKey, privateKey }
   */
  static generateRSAKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  }

  /**
   * Encrypt a private key using a password (PBKDF2)
   * @param {string} privateKey - The raw private key (PEM)
   * @param {string} password - User password
   * @param {string} salt - Random salt for PBKDF2
   * @returns {string} Encrypted private key in base64 format (iv:authTag:encryptedData)
   */
  static encryptPrivateKey(privateKey, password, salt) {
    const derivedKey = crypto.pbkdf2Sync(password, salt, this.PBKDF2_ITERATIONS, this.PBKDF2_KEY_LEN, this.PBKDF2_DIGEST);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, derivedKey, iv);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    return `${iv.toString('base64')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt a private key using a password (PBKDF2)
   * @param {string} encryptedPrivateKey - (iv:authTag:encryptedData)
   * @param {string} password - User password
   * @param {string} salt - Random salt used during encryption
   * @returns {string} Decrypted private key (PEM)
   */
  static decryptPrivateKey(encryptedPrivateKey, password, salt) {
    const parts = encryptedPrivateKey.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted private key format');
    
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encryptedData = parts[2];

    const derivedKey = crypto.pbkdf2Sync(password, salt, this.PBKDF2_ITERATIONS, this.PBKDF2_KEY_LEN, this.PBKDF2_DIGEST);
    const decipher = crypto.createDecipheriv(this.ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate a Random File Encryption Key (FEK)
   * @returns {Buffer} 256-bit (32 bytes) key
   */
  static generateFEK() {
    return crypto.randomBytes(this.KEY_LENGTH);
  }

  /**
   * Encrypt the FEK using the user's RSA Public Key
   * @param {Buffer} fek - File Encryption Key
   * @param {string} publicKey - PEM public key
   * @returns {string} Encrypted FEK in base64
   */
  static encryptFEK(fek, publicKey) {
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      fek
    );
    return encrypted.toString('base64');
  }

  /**
   * Decrypt the FEK using the user's RSA Private Key
   * @param {string} encryptedFEKBase64 - Encrypted FEK
   * @param {string} privateKey - PEM private key
   * @returns {Buffer} Decrypted File Encryption Key
   */
  static decryptFEK(encryptedFEKBase64, privateKey) {
    return crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(encryptedFEKBase64, 'base64')
    );
  }

  /**
   * Encrypt file buffer directly (For small chunks/files)
   * In a real chunked streaming scenario, you'd use a Transform stream.
   */
  static encryptFileBuffer(buffer, fek) {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, fek, iv);
    
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Return combined buffer: iv (12) + authTag (16) + encrypted
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt file buffer directly
   */
  static decryptFileBuffer(buffer, fek) {
    const iv = buffer.subarray(0, this.IV_LENGTH);
    const authTag = buffer.subarray(this.IV_LENGTH, this.IV_LENGTH + this.AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(this.IV_LENGTH + this.AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(this.ALGORITHM, fek, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Calculate SHA-256 checksum
   */
  static calculateChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

module.exports = CryptoService;
