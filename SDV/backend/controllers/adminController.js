const { PrismaClient } = require('@prisma/client');
const AuditService = require('../services/auditService');
const prisma = new PrismaClient();

exports.getPendingUsers = async (req, res) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { status: 'PENDING' },
      select: { id: true, email: true, name: true, createdAt: true }
    });
    res.json(pendingUsers);
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.approveUser = async (req, res) => {
  const { userId, roleName } = req.body; // e.g., 'User', 'Admin', 'Auditor'

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'PENDING') {
      return res.status(404).json({ error: 'Pending user not found' });
    }

    if (roleName === 'Admin') {
      return res.status(403).json({ error: 'Cannot assign Admin role' });
    }

    let role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      // Create role if it doesn't exist (in a real app, roles would be pre-seeded)
      role = await prisma.role.create({ data: { name: roleName } });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' }
    });

    await prisma.userRole.create({
      data: {
        userId: updatedUser.id,
        roleId: role.id
      }
    });

    await AuditService.logEvent({
      userId: req.user.id,
      action: 'Approval',
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: req.headers['user-agent'],
      targetFile: updatedUser.id // Note: using targetFile to store the user id that was approved
    });

    res.json({ message: 'User approved and role assigned successfully' });
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    // Count only users with the 'User' role (not Admin/Security Manager)
    const userRole = await prisma.role.findUnique({ where: { name: 'User' } });
    const totalUsers = userRole
      ? await prisma.userRole.count({ where: { roleId: userRole.id } })
      : 0;

    const totalFiles = await prisma.file.count();
    
    const storageUsage = await prisma.file.aggregate({
      _sum: { fileSize: true }
    });
    
    const securityEvents = await prisma.auditLog.count();

    res.json({
      totalUsers,
      totalFiles,
      storageUsed: (storageUsage._sum.fileSize || 0n).toString(),
      securityEvents
    });
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: {
        user: { select: { email: true, name: true } }
      }
    });
    res.json(logs);
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

// ─── GET ALL USER ACCOUNTS (with flag info) ─────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        roles: { include: { role: true } },
        _count: {
          select: {
            ownedFiles: true,
            auditLogs: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get flag data
    const flags = await prisma.auditLog.findMany({
      where: { action: 'FLAG_ACCOUNT' },
      orderBy: { timestamp: 'desc' }
    });

    const unflags = await prisma.auditLog.findMany({
      where: { action: 'UNFLAG_ACCOUNT' },
      orderBy: { timestamp: 'desc' }
    });

    const flagMap = {};
    flags.forEach(f => {
      if (f.targetFile && !flagMap[f.targetFile]) {
        flagMap[f.targetFile] = {
          reason: f.device || 'Suspicious activity',
          flaggedAt: f.timestamp,
          flaggedBy: f.userId
        };
      }
    });

    unflags.forEach(uf => {
      if (uf.targetFile && flagMap[uf.targetFile]) {
        if (new Date(uf.timestamp) > new Date(flagMap[uf.targetFile].flaggedAt)) {
          delete flagMap[uf.targetFile];
        }
      }
    });

    const enriched = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      roles: u.roles.map(ur => ur.role.name),
      fileCount: u._count.ownedFiles,
      activityCount: u._count.auditLogs,
      flag: flagMap[u.id] || null
    }));

    res.json(enriched);
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// ─── DELETE USER ACCOUNT ────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if target is Admin
    const targetRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });
    if (targetRoles.some(ur => ur.role.name === 'Admin')) {
      return res.status(403).json({ error: 'Cannot delete admin accounts' });
    }

    // Delete user (cascades will handle related records)
    await prisma.user.delete({ where: { id: userId } });

    await AuditService.logEvent({
      userId: req.user.id,
      action: 'DELETE_ACCOUNT',
      targetFile: userId,
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: `Deleted user: ${target.email}`
    });

    res.json({ message: 'User account deleted successfully' });
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
