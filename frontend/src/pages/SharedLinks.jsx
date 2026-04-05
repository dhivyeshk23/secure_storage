import { useState, useEffect } from 'react';
import { getAllShareLinks, revokeShareLink } from '../services/api';
import { useAuth } from '../context/AuthContext';

const APP_BASE = typeof window !== 'undefined' ? window.location.origin : '';

export default function SharedLinks() {
  const { user } = useAuth();
  const [activeLinks, setActiveLinks] = useState([]);
  const [expiredLinks, setExpiredLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('active');
  const [copiedId, setCopiedId] = useState(null);
  const [revoking, setRevoking] = useState({});

  const fetchLinks = async () => {
    try {
      const res = await getAllShareLinks();
      setActiveLinks(res.data.active || []);
      setExpiredLinks(res.data.expired || []);
    } catch (err) {
      setError('Failed to load share links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLinks(); }, []);

  const handleRevoke = async (linkId) => {
    if (!window.confirm('Revoke this share link? It will stop working immediately.')) return;
    setRevoking(prev => ({ ...prev, [linkId]: true }));
    try {
      await revokeShareLink(linkId);
      // Move from active to expired
      const revoked = activeLinks.find(l => l.id === linkId);
      setActiveLinks(prev => prev.filter(l => l.id !== linkId));
      if (revoked) {
        setExpiredLinks(prev => [{ ...revoked, isActive: false }, ...prev]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke link');
    } finally {
      setRevoking(prev => ({ ...prev, [linkId]: false }));
    }
  };

  const copyToClipboard = (token, linkId) => {
    navigator.clipboard.writeText(`${APP_BASE}/share/${token}`).then(() => {
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getTimeRemaining = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  const getFileIcon = (type) => {
    const icons = { text: '📝', pdf: '📄', image: '🖼️', audio: '🎵', video: '🎬', document: '📑', spreadsheet: '📊', archive: '📦' };
    return icons[type] || '📎';
  };

  const formatDate = (d) => new Date(d).toLocaleString();

  if (loading) return <div className="loading">Loading shared links...</div>;

  const currentLinks = tab === 'active' ? activeLinks : expiredLinks;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>🔗 Shared Links</h1>
          <p className="subtitle">Manage all your shared file links in one place.</p>
        </div>
        <div className="shared-stats-row">
          <div className="shared-stat-chip active-chip">
            <span className="shared-stat-number">{activeLinks.length}</span>
            <span>Active</span>
          </div>
          <div className="shared-stat-chip expired-chip">
            <span className="shared-stat-number">{expiredLinks.length}</span>
            <span>Expired</span>
          </div>
          <div className="shared-stat-chip total-chip">
            <span className="shared-stat-number">{activeLinks.reduce((s, l) => s + l.downloadCount, 0)}</span>
            <span>Downloads</span>
          </div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          🟢 Active ({activeLinks.length})
        </button>
        <button className={`tab-btn ${tab === 'expired' ? 'active' : ''}`} onClick={() => setTab('expired')}>
          ⏰ Expired / Revoked ({expiredLinks.length})
        </button>
      </div>

      {currentLinks.length === 0 ? (
        <div className="empty-state">
          <p>{tab === 'active'
            ? 'No active share links. Go to My Vault and click "Share" on any file to create one.'
            : 'No expired or revoked links yet.'}</p>
        </div>
      ) : (
        <div className="shared-links-grid">
          {currentLinks.map(link => (
            <div key={link.id} className={`shared-link-card ${!link.isActive ? 'revoked' : ''}`}>
              <div className="shared-link-top">
                <div className="shared-link-file-info">
                  <span className="shared-link-file-icon">
                    {link.vaultItem ? getFileIcon(link.vaultItem.fileType) : '📎'}
                  </span>
                  <div>
                    <h3 className="shared-link-file-title">
                      {link.vaultItem?.title || 'Deleted File'}
                    </h3>
                    {link.vaultItem?.originalFileName && (
                      <span className="shared-link-filename">{link.vaultItem.originalFileName}</span>
                    )}
                  </div>
                </div>
                {link.vaultItem?.sensitivityLevel && (
                  <span className={`sensitivity-badge s-${link.vaultItem.sensitivityLevel.toLowerCase()}`}>
                    {link.vaultItem.sensitivityLevel}
                  </span>
                )}
              </div>

              {link.label && (
                <div className="shared-link-label-row">
                  🏷️ <span>{link.label}</span>
                </div>
              )}

              <div className="shared-link-details">
                <div className="shared-link-detail">
                  <span className="detail-label">Status</span>
                  <span className={`status-badge ${link.isActive ? 'status-success' : 'status-failed'}`}>
                    {link.isActive ? 'Active' : 'Revoked'}
                  </span>
                </div>
                <div className="shared-link-detail">
                  <span className="detail-label">Time Left</span>
                  <span className={`detail-value ${new Date(link.expiresAt) < new Date() ? 'expired-text' : ''}`}>
                    {getTimeRemaining(link.expiresAt)}
                  </span>
                </div>
                <div className="shared-link-detail">
                  <span className="detail-label">Downloads</span>
                  <span className="detail-value">
                    {link.downloadCount} {link.maxDownloads > 0 ? `/ ${link.maxDownloads}` : '(no limit)'}
                  </span>
                </div>
                <div className="shared-link-detail">
                  <span className="detail-label">Security</span>
                  <span className="detail-value">{link.hasPassword ? '🔒 Password' : '🔓 Open'}</span>
                </div>
                <div className="shared-link-detail">
                  <span className="detail-label">Created</span>
                  <span className="detail-value">{formatDate(link.createdAt)}</span>
                </div>
                {link.lastDownloadedAt && (
                  <div className="shared-link-detail">
                    <span className="detail-label">Last Download</span>
                    <span className="detail-value">{formatDate(link.lastDownloadedAt)}</span>
                  </div>
                )}
              </div>

              {/* Progress bar for download limit */}
              {link.maxDownloads > 0 && (
                <div className="shared-link-progress">
                  <div className="shared-link-progress-bar">
                    <div
                      className="shared-link-progress-fill"
                      style={{ width: `${Math.min((link.downloadCount / link.maxDownloads) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="shared-link-progress-label">
                    {link.downloadCount}/{link.maxDownloads} downloads
                  </span>
                </div>
              )}

              {/* Actions */}
              {link.isActive && (
                <div className="shared-link-actions">
                  <button
                    className={`btn btn-sm ${copiedId === link.id ? 'btn-success-solid' : 'btn-secondary'}`}
                    onClick={() => copyToClipboard(link.token, link.id)}
                  >
                    {copiedId === link.id ? '✓ Copied!' : '📋 Copy Link'}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRevoke(link.id)}
                    disabled={revoking[link.id]}
                  >
                    {revoking[link.id] ? '...' : '✕ Revoke'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
