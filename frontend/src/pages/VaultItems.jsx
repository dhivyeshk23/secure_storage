import { useState, useEffect } from 'react';
import { getVaultItems, deleteVaultItem, viewEncrypted, createShareLink, getShareLinks, revokeShareLink } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FILE_TYPE_ICONS } from '../components/Navbar';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE = isLocalhost ? 'http://localhost:5000/api' : 'https://backend-one-blush-33.vercel.app/api';
const APP_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const EXPIRY_OPTIONS = [
  { label: '15 minutes', value: '15m' },
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

const DOWNLOAD_OPTIONS = [
  { label: 'Unlimited', value: 0 },
  { label: '1 download', value: 1 },
  { label: '5 downloads', value: 5 },
  { label: '10 downloads', value: 10 },
  { label: '25 downloads', value: 25 },
];

export default function VaultItems() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decryptedData, setDecryptedData] = useState({});
  const [encryptedViewData, setEncryptedViewData] = useState({});
  const [decrypting, setDecrypting] = useState({});
  const [viewingEncrypted, setViewingEncrypted] = useState({});
  const [error, setError] = useState('');
  const [reAuthModal, setReAuthModal] = useState(null);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [filter, setFilter] = useState('all');

  // Share modal state
  const [shareModal, setShareModal] = useState(null); // item being shared
  const [shareForm, setShareForm] = useState({ expiresIn: '24h', maxDownloads: 0, password: '', label: '' });
  const [shareCreating, setShareCreating] = useState(false);
  const [shareResult, setShareResult] = useState(null);
  const [shareError, setShareError] = useState('');
  const [existingLinks, setExistingLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await getVaultItems();
      setItems(res.data.items);
    } catch (err) {
      setError('Failed to load vault items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleViewEncrypted = async (id) => {
    setViewingEncrypted(prev => ({ ...prev, [id]: true }));
    setError('');
    try {
      const res = await viewEncrypted(id);
      setEncryptedViewData(prev => ({ ...prev, [id]: res.data.vaultItem }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to view encrypted data');
    } finally {
      setViewingEncrypted(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleRetrieve = async (id, password = null) => {
    setDecrypting(prev => ({ ...prev, [id]: true }));
    setError('');
    try {
      const token = localStorage.getItem('token');
      const url = new URL(`${API_BASE}/vault/retrieve/${id}`);
      if (password) url.searchParams.set('password', password);

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 428) {
        setReAuthModal(id);
        setDecrypting(prev => ({ ...prev, [id]: false }));
        return;
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to retrieve');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        const blob = await response.blob();
        const url2 = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        const item = items.find(i => i._id === id);
        a.download = item?.originalFileName || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url2);
        a.remove();
        setDecryptedData(prev => ({ ...prev, [id]: { isFile: true, fileName: item?.originalFileName } }));
      } else {
        const data = await response.json();
        setDecryptedData(prev => ({ ...prev, [id]: data.vaultItem }));
      }
      setReAuthModal(null);
      setReAuthPassword('');
    } catch (err) {
      setError(err.message || 'Failed to retrieve data');
    } finally {
      setDecrypting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleReAuthSubmit = (e) => {
    e.preventDefault();
    if (reAuthModal && reAuthPassword) {
      handleRetrieve(reAuthModal, reAuthPassword);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteVaultItem(id);
      setItems(items.filter(i => i._id !== id));
      setDecryptedData(prev => { const c = { ...prev }; delete c[id]; return c; });
      setEncryptedViewData(prev => { const c = { ...prev }; delete c[id]; return c; });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete item');
    }
  };

  // ─── Share link handlers ───────────────────────────────────────────

  const openShareModal = async (item) => {
    if (item.sensitivityLevel === 'CRITICAL') {
      setError('CRITICAL sensitivity files cannot be shared.');
      return;
    }
    setShareModal(item);
    setShareForm({ expiresIn: '24h', maxDownloads: 0, password: '', label: '' });
    setShareResult(null);
    setShareError('');
    setCopied(false);
    setLoadingLinks(true);

    try {
      const res = await getShareLinks(item._id);
      setExistingLinks(res.data.links || []);
    } catch {
      setExistingLinks([]);
    } finally {
      setLoadingLinks(false);
    }
  };

  const closeShareModal = () => {
    setShareModal(null);
    setShareResult(null);
    setShareError('');
    setExistingLinks([]);
  };

  const handleCreateShareLink = async (e) => {
    e.preventDefault();
    setShareCreating(true);
    setShareError('');
    setShareResult(null);
    setCopied(false);

    try {
      const res = await createShareLink({
        itemId: shareModal._id,
        expiresIn: shareForm.expiresIn,
        maxDownloads: shareForm.maxDownloads,
        password: shareForm.password || undefined,
        label: shareForm.label || undefined,
      });
      setShareResult(res.data.shareLink);
      // Refresh existing links
      const linksRes = await getShareLinks(shareModal._id);
      setExistingLinks(linksRes.data.links || []);
    } catch (err) {
      setShareError(err.response?.data?.error || 'Failed to create share link');
    } finally {
      setShareCreating(false);
    }
  };

  const handleRevokeLink = async (linkId) => {
    if (!window.confirm('Revoke this share link? It will stop working immediately.')) return;
    try {
      await revokeShareLink(linkId);
      setExistingLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (err) {
      setShareError(err.response?.data?.error || 'Failed to revoke link');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getShareUrl = (token) => `${APP_BASE}/share/${token}`;

  const getTimeRemaining = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (86400000));
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const filteredItems = filter === 'all' ? items : items.filter(i => i.fileType === filter);

  if (loading) return <div className="loading">Loading vault items...</div>;

  return (
    <div className="page">
      <h1>🗄️ My Vault</h1>
      <p className="subtitle">
        {items.length} encrypted item{items.length !== 1 ? 's' : ''} stored.
      </p>

      {error && <div className="error-msg">{error}</div>}

      {/* Re-auth Modal */}
      {reAuthModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>🔑 Password Re-confirmation Required</h3>
            <p>This is <strong>CRITICAL</strong> sensitivity data. Please confirm your password to proceed.</p>
            <form onSubmit={handleReAuthSubmit}>
              <div className="form-group">
                <input type="password" value={reAuthPassword} onChange={(e) => setReAuthPassword(e.target.value)} placeholder="Enter your password" required autoFocus />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={decrypting[reAuthModal]}>
                  {decrypting[reAuthModal] ? 'Verifying...' : 'Confirm & Decrypt'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setReAuthModal(null); setReAuthPassword(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeShareModal(); }}>
          <div className="share-modal-card">
            <div className="share-modal-header">
              <h3>🔗 Share "{shareModal.title}"</h3>
              <button className="btn-close" onClick={closeShareModal}>✕</button>
            </div>

            {shareModal.sensitivityLevel === 'HIGH' && (
              <div className="share-warning">
                ⚠️ HIGH sensitivity — password is required for this file.
              </div>
            )}

            {shareError && <div className="error-msg">{shareError}</div>}

            {/* Create new link form */}
            <form onSubmit={handleCreateShareLink} className="share-form">
              <div className="share-form-row">
                <div className="form-group">
                  <label>⏱️ Expires In</label>
                  <select value={shareForm.expiresIn} onChange={(e) => setShareForm(p => ({ ...p, expiresIn: e.target.value }))}>
                    {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>📥 Max Downloads</label>
                  <select value={shareForm.maxDownloads} onChange={(e) => setShareForm(p => ({ ...p, maxDownloads: parseInt(e.target.value) }))}>
                    {DOWNLOAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>🏷️ Label (optional)</label>
                <input type="text" value={shareForm.label} onChange={(e) => setShareForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g., For review by Team A" />
              </div>

              <div className="form-group">
                <label>🔒 Password {shareModal.sensitivityLevel === 'HIGH' ? '(required)' : '(optional)'}</label>
                <input type="password" value={shareForm.password} onChange={(e) => setShareForm(p => ({ ...p, password: e.target.value }))} placeholder="Set a password for the link" required={shareModal.sensitivityLevel === 'HIGH'} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={shareCreating}>
                {shareCreating ? '⏳ Creating...' : '🔗 Generate Share Link'}
              </button>
            </form>

            {/* Generated link result */}
            {shareResult && (
              <div className="share-result">
                <div className="share-result-header">✅ Link Created!</div>
                <div className="share-link-box">
                  <input type="text" readOnly value={getShareUrl(shareResult.token)} className="share-link-input" />
                  <button className={`btn btn-sm ${copied ? 'btn-success-solid' : 'btn-primary'}`} onClick={() => copyToClipboard(getShareUrl(shareResult.token))}>
                    {copied ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <div className="share-result-meta">
                  <span>⏱️ Expires: {new Date(shareResult.expiresAt).toLocaleString()}</span>
                  <span>📥 Max: {shareResult.maxDownloads || 'Unlimited'}</span>
                  {shareResult.hasPassword && <span>🔒 Password protected</span>}
                </div>
              </div>
            )}

            {/* Existing links section */}
            <div className="share-existing">
              <h4>📋 Active Share Links ({existingLinks.length})</h4>
              {loadingLinks ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>Loading...</p>
              ) : existingLinks.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>No active share links for this item.</p>
              ) : (
                <div className="share-links-list">
                  {existingLinks.map(link => (
                    <div key={link.id} className="share-link-item">
                      <div className="share-link-info">
                        <span className="share-link-label">{link.label || 'Unnamed link'}</span>
                        <div className="share-link-stats">
                          <span>⏱️ {getTimeRemaining(link.expiresAt)} left</span>
                          <span>📥 {link.downloadCount}{link.maxDownloads > 0 ? `/${link.maxDownloads}` : ''} downloads</span>
                          {link.hasPassword && <span>🔒</span>}
                        </div>
                      </div>
                      <div className="share-link-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(getShareUrl(link.token))} title="Copy link">📋</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleRevokeLink(link.id)} title="Revoke link">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="filter-bar">
        <label>Filter: </label>
        {['all', 'text', 'pdf', 'image', 'audio', 'video', 'document', 'spreadsheet', 'archive'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
            {f === 'all' ? '📋 All' : `${FILE_TYPE_ICONS[f] || '📎'} ${f}`}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state">
          <p>{filter === 'all' ? 'No items in your vault yet. Go to "Store Data" to add encrypted data.' : `No ${filter} items found.`}</p>
        </div>
      ) : (
        <div className="vault-grid">
          {filteredItems.map(item => (
            <div key={item._id} className="vault-card">
              <div className="vault-card-header">
                <h3>{FILE_TYPE_ICONS[item.fileType] || '📎'} {item.title}</h3>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span className={`sensitivity-badge s-${item.sensitivityLevel.toLowerCase()}`}>{item.sensitivityLevel}</span>
                </div>
              </div>

              <div className="vault-card-body">
                <div className="info-item"><strong>Type:</strong> {item.fileType?.toUpperCase()}</div>
                {item.originalFileName && <div className="info-item"><strong>File:</strong> {item.originalFileName}</div>}
                <div className="info-item">
                  <strong>Encryption:</strong>{' '}
                  <span className={`strategy-badge strategy-${item.encryptionStrategy.toLowerCase()}`}>{item.encryptionStrategy}</span>
                </div>
                <div className="info-item"><strong>Algorithm:</strong> {item.algorithm}</div>
                <div className="info-item"><strong>Stored:</strong> {new Date(item.createdAt).toLocaleString()}</div>
                {item.owner && <div className="info-item"><strong>Owner:</strong> {item.owner.username} ({item.owner.role})</div>}
              </div>

              {/* Encrypted section */}
              {encryptedViewData[item._id] && (
                <div className="encrypted-section">
                  <h4>🔒 Encrypted Data (Ciphertext)</h4>
                  <div className="encrypted-data">{encryptedViewData[item._id].encryptedData?.substring(0, 200)}...</div>
                  <div className="encryption-details">
                    <span><strong>IV:</strong> {encryptedViewData[item._id].iv}</span>
                    {encryptedViewData[item._id].authTag && <span><strong>Auth Tag:</strong> {encryptedViewData[item._id].authTag}</span>}
                    {encryptedViewData[item._id].checksum && <span><strong>SHA-256:</strong> {encryptedViewData[item._id].checksum}</span>}
                  </div>
                  <p className="encrypted-notice">⚠️ This is ENCRYPTED data — not readable without the decryption key</p>
                </div>
              )}

              {/* Decrypted section */}
              {decryptedData[item._id] && !decryptedData[item._id].isFile && (
                <div className="decrypted-section">
                  <h4>🔓 Decrypted Data</h4>
                  <pre className="decrypted-data">{decryptedData[item._id].data}</pre>
                  {item.metadata?.contextSnapshot && (
                    <div className="context-info">
                      <span>Role: {item.metadata.contextSnapshot.role}</span>
                      <span>Location: {item.metadata.contextSnapshot.location}</span>
                      <span>Policy: {item.metadata.contextSnapshot.policyDecision}</span>
                    </div>
                  )}
                </div>
              )}
              {decryptedData[item._id]?.isFile && (
                <div className="decrypted-section">
                  <h4>✅ File Downloaded!</h4>
                  <p style={{ color: '#81c784' }}>The decrypted file has been downloaded: {decryptedData[item._id].fileName}</p>
                </div>
              )}

              <div className="vault-card-actions">
                <button onClick={() => handleViewEncrypted(item._id)} className="btn btn-secondary btn-sm" disabled={viewingEncrypted[item._id]}>
                  {viewingEncrypted[item._id] ? '...' : '🔒 Encrypted'}
                </button>
                <button onClick={() => handleRetrieve(item._id)} className="btn btn-primary btn-sm" disabled={decrypting[item._id]}>
                  {decrypting[item._id] ? '...' : item.fileType !== 'text' ? '🔓 Decrypt & Download' : decryptedData[item._id] ? '🔄 Re-decrypt' : '🔓 Decrypt'}
                </button>
                <button onClick={() => openShareModal(item)} className={`btn btn-sm ${item.sensitivityLevel === 'CRITICAL' ? 'btn-secondary' : 'btn-share'}`} disabled={item.sensitivityLevel === 'CRITICAL'} title={item.sensitivityLevel === 'CRITICAL' ? 'CRITICAL files cannot be shared' : 'Create share link'}>
                  🔗 Share
                </button>
                {(user.role === 'admin' || item.owner?._id === user.id) && (
                  <button onClick={() => handleDelete(item._id, item.title)} className="btn btn-danger btn-sm">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
