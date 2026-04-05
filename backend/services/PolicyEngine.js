/**
 * Policy Engine — Evaluates access context to determine encryption strength
 * and access permissions using a scored risk-assessment model.
 *
 * Factors:
 *   1. User Role (admin, student/employee, professor/guest)
 *   2. Data Sensitivity Level (LOW, MEDIUM, HIGH, CRITICAL)
 *   3. Access Location (internal, external, remote)
 *   4. Time of Access (business hours vs off-hours)
 *   5. Device Type (desktop, mobile, tablet)
 *
 * Output: Encryption strategy mapped to 6 tiers
 */

class PolicyEngine {
  /**
   * Evaluate context and determine encryption strategy + risk score.
   */
  static evaluate(context) {
    const { role, sensitivityLevel, location, timestamp, deviceType } = context;

    let score = 0;
    const reasons = [];

    // ── Sensitivity scoring ──
    switch (sensitivityLevel) {
      case 'CRITICAL':
        score += 40;
        reasons.push('CRITICAL sensitivity data (+40)');
        break;
      case 'HIGH':
        score += 30;
        reasons.push('HIGH sensitivity data (+30)');
        break;
      case 'MEDIUM':
        score += 20;
        reasons.push('MEDIUM sensitivity data (+20)');
        break;
      case 'LOW':
        score += 10;
        reasons.push('LOW sensitivity data (+10)');
        break;
      default:
        score += 20;
        reasons.push('Unknown sensitivity, defaulting to MEDIUM (+20)');
    }

    // ── Role scoring ──
    switch (role) {
      case 'professor':
        score += 20;
        reasons.push('Guest/Professor role — higher encryption needed (+20)');
        break;
      case 'student':
        score += 10;
        reasons.push('Employee/Student role — standard encryption (+10)');
        break;
      case 'admin':
        score += 5;
        reasons.push('Admin role — trusted access (+5)');
        break;
      default:
        score += 20;
        reasons.push('Unknown role, treating as guest (+20)');
    }

    // ── Location scoring ──
    switch (location) {
      case 'remote':
        score += 20;
        reasons.push('Remote access — highest risk (+20)');
        break;
      case 'external':
        score += 15;
        reasons.push('External access — elevated risk (+15)');
        break;
      case 'internal':
        score += 5;
        reasons.push('Internal access — low risk (+5)');
        break;
      default:
        score += 15;
        reasons.push('Unknown location, treating as external (+15)');
    }

    // ── Time scoring ──
    const hour = timestamp ? new Date(timestamp).getHours() : new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      score += 0;
      reasons.push('Business hours access (+0)');
    } else if (hour >= 6 && hour <= 21) {
      score += 5;
      reasons.push('Extended hours access (+5)');
    } else {
      score += 15;
      reasons.push('Off-hours access — suspicious (+15)');
    }

    // ── Device type scoring ──
    switch (deviceType) {
      case 'mobile':
        score += 10;
        reasons.push('Mobile device — higher risk (+10)');
        break;
      case 'tablet':
        score += 5;
        reasons.push('Tablet device — moderate risk (+5)');
        break;
      case 'desktop':
        score += 0;
        reasons.push('Desktop device (+0)');
        break;
      default:
        score += 5;
        reasons.push('Unknown device type (+5)');
    }

    // ── Strategy determination (6 tiers) ──
    let strategy;
    if (score >= 80) {
      strategy = 'CHACHA';
      reasons.push('→ Maximum security: ChaCha20-Poly1305 selected');
    } else if (score >= 65) {
      strategy = 'STRONG';
      reasons.push('→ High security: AES-256-GCM selected');
    } else if (score >= 50) {
      strategy = 'ADVANCED';
      reasons.push('→ Advanced security: AES-256-CBC selected');
    } else if (score >= 35) {
      strategy = 'STANDARD';
      reasons.push('→ Standard security: AES-192-CBC selected');
    } else if (score >= 20) {
      strategy = 'BASIC';
      reasons.push('→ Basic security: AES-128-CBC selected');
    } else {
      strategy = 'LEGACY';
      reasons.push('→ Legacy security: Triple-DES selected');
    }

    return {
      strategy,
      score,
      reasons,
      evaluatedAt: new Date().toISOString(),
      riskLevel: score >= 65 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW'
    };
  }

  /**
   * Check if a role is allowed to access a given sensitivity level.
   */
  static checkAccess(role, sensitivityLevel) {
    const accessMatrix = {
      admin: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      student: ['LOW', 'MEDIUM', 'HIGH'],
      professor: ['LOW']
    };

    const allowed = accessMatrix[role] || [];
    return {
      granted: allowed.includes(sensitivityLevel),
      allowedLevels: allowed,
      requiresReAuth: sensitivityLevel === 'CRITICAL',
      message: allowed.includes(sensitivityLevel)
        ? `Access granted: ${role} can access ${sensitivityLevel} data`
        : `Access denied: ${role} cannot access ${sensitivityLevel} data`
    };
  }

  /**
   * Check if access requires additional verification (CRITICAL data).
   */
  static requiresReAuthentication(sensitivityLevel) {
    return sensitivityLevel === 'CRITICAL';
  }

  /**
   * Detect suspicious access patterns — high-frequency decryption attempts.
   * @param {Array} recentAccesses - Array of recent access timestamps
   * @param {number} windowMinutes - Time window in minutes
   * @param {number} maxAttempts - Max allowed attempts in window
   */
  static detectSuspiciousPattern(recentAccesses, windowMinutes = 5, maxAttempts = 10) {
    const windowMs = windowMinutes * 60 * 1000;
    const now = Date.now();
    const inWindow = recentAccesses.filter(ts => (now - new Date(ts).getTime()) < windowMs);

    return {
      suspicious: inWindow.length >= maxAttempts,
      accessCount: inWindow.length,
      maxAllowed: maxAttempts,
      windowMinutes,
      message: inWindow.length >= maxAttempts
        ? `Suspicious: ${inWindow.length} accesses in ${windowMinutes} min (max: ${maxAttempts})`
        : 'Access pattern normal'
    };
  }
}

module.exports = PolicyEngine;
