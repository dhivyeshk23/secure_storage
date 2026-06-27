const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AuditService {
  /**
   * Log an audit event
   * @param {Object} data
   * @param {string} data.userId - Optional ID of the user performing the action
   * @param {string} data.action - E.g. 'Upload', 'Download', 'Login', 'Share'
   * @param {string} data.targetFile - Optional ID of the affected file
   * @param {string} data.status - 'SUCCESS', 'FAILED', 'DENIED'
   * @param {string} data.ipAddress - Request IP
   * @param {string} data.device - User Agent
   */
  static async logEvent({ userId, action, targetFile, status, ipAddress, device }) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action,
          targetFile: targetFile || null,
          status,
          ipAddress: ipAddress || null,
          device: device || null,
        }
      });
    } catch (error) {
      console.error('Audit Log failed:', error);
      // Ensure failure to audit does not crash the app, but triggers alerts in production.
    }
  }
}

module.exports = AuditService;
