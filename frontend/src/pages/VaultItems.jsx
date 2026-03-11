import { useState, useEffect } from 'react';
import { getVaultItems, deleteVaultItem, updateCategory, getShareUsers, shareItem, getTimeline } from '../services/api';
import { useAuth } from '../context/AuthContext';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE = isLocalhost ? 'http://localhost:5000/api' : 'https://backend-one-blush-33.vercel.app/api';

export default function VaultItems() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decryptedData, setDecryptedData] = useState({});
  const [encryptedViewData, setEncryptedViewData] = useState({});
  const [decrypting, setDecrypting] = useState({});
  const [viewingEncrypted, setViewingEncrypted] = useState({});
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showShareModal, setShowShareModal] = useState(null);
  const [shareUsers, setShareUsers] = useState([]);
  const [showTimeline, setShowTimeline] = useState(null);
  const [timeline, setTimeline] = useState([]);

  const fetchItems = async () => {
    try {
      const res = await getVaultItems({ search, category: categoryFilter, fileType: typeFilter });
      setItems(res.data.items);
    } catch (err) { setError('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, [search, categoryFilter, typeFilter]);

  const handleViewEncrypted = async (id) => {
    setViewingEncrypted(prev => ({ ...prev, [id]: true }));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/vault/view-encrypted/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setEncryptedViewData(prev => ({ ...prev, [id]: data.vaultItem }));
    } catch (err) { setError(err.message); }
    finally { setViewingEncrypted(prev => ({ ...prev, [id]: false })); }
  };

  const handleRetrieve = async (id) => {
    setDecrypting(prev => ({ ...prev, [id]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/vault/retrieve/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.headers.get('content-type')?.includes('application/pdf')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'file.pdf'; a.click();
        setDecryptedData(prev => ({ ...prev, [id]: { isPdf: true } }));
      } else {
        const data = await response.json();
        setDecryptedData(prev => ({ ...prev, [id]: data.vaultItem }));
      }
    } catch (err) { setError(err.message); }
    finally { setDecrypting(prev => ({ ...prev, [id]: false })); }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await deleteVaultItem(id);
      setItems(items.filter(i => i._id !== id));
    } catch (err) { setError(err.response?.data?.error); }
  };

  const handleCategoryChange = async (id, newCategory) => {
    try {
      await updateCategory(id, newCategory);
      fetchItems();
    } catch (err) { setError(err.message); }
  };

  const handleShareClick = async (id) => {
    setShowShareModal(id);
    try {
      const res = await getShareUsers();
      setShareUsers(res.data.users);
    } catch (err) { setError(err.message); }
  };

  const handleShare = async (itemId, userId) => {
    try {
      await shareItem(itemId, userId, true);
      setShowShareModal(null);
      fetchItems();
    } catch (err) { setError(err.message); }
  };

  const handleTimelineClick = async (id) => {
    setShowTimeline(id);
    try {
      const res = await getTimeline(id);
      setTimeline(res.data.timeline);
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <h1>My Vault</h1>
      
      <div className="vault-filters">
        <input type="text" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="All">All Categories</option>
          {['Personal', 'Work', 'Finance', 'Medical', 'Legal', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="text">Text</option>
          <option value="pdf">PDF</option>
          <option value="note">Note</option>
          <option value="password">Password</option>
        </select>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {items.length === 0 ? (
        <div className="empty-state"><p>No items found</p></div>
      ) : (
        <div className="vault-grid">
          {items.map(item => (
            <div key={item._id} className="vault-card">
              <div className="vault-card-header">
                <h3>{item.title}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {item.fileType === 'pdf' && <span className="file-type-badge">PDF</span>}
                  {item.fileType === 'note' && <span className="file-type-badge">📋</span>}
                  {item.fileType === 'password' && <span className="file-type-badge">🔑</span>}
                  <span className={`sensitivity-badge s-${item.sensitivityLevel.toLowerCase()}`}>{item.sensitivityLevel}</span>
                </div>
              </div>

              <div className="vault-card-body">
                <div className="info-item"><strong>Category:</strong> 
                  <select value={item.category} onChange={e => handleCategoryChange(item._id, e.target.value)} className="category-select">
                    {['Personal', 'Work', 'Finance', 'Medical', 'Legal', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="info-item"><strong>Encryption:</strong> <span className={`strategy-badge strategy-${item.encryptionStrategy?.toLowerCase()}`}>{item.encryptionStrategy}</span></div>
                <div className="info-item"><strong>Stored:</strong> {new Date(item.createdAt).toLocaleDateString()}</div>
                {item.sharedWith?.length > 0 && <div className="info-item"><strong>Shared with:</strong> {item.sharedWith.length} user(s)</div>}
              </div>

              {encryptedViewData[item._id] && (
                <div className="encrypted-section">
                  <h4>🔒 Encrypted Data:</h4>
                  <div className="encrypted-data">{encryptedViewData[item._id].encryptedData?.substring(0, 150)}...</div>
                </div>
              )}

              {decryptedData[item._id] && !decryptedData[item._id].isPdf && (
                <div className="decrypted-section">
                  <h4>🔓 Decrypted:</h4>
                  <pre className="decrypted-data">{typeof decryptedData[item._id].data === 'object' ? JSON.stringify(decryptedData[item._id].data, null, 2) : decryptedData[item._id].data}</pre>
                </div>
              )}

              {decryptedData[item._id]?.isPdf && <div className="decrypted-section"><h4>📄 PDF Downloaded</h4></div>}

              <div className="vault-card-actions">
                <button onClick={() => handleViewEncrypted(item._id)} className="btn btn-warning btn-sm">🔒 Encrypted</button>
                <button onClick={() => handleRetrieve(item._id)} className="btn btn-primary btn-sm">🔓 Decrypt</button>
                <button onClick={() => handleTimelineClick(item._id)} className="btn btn-secondary btn-sm">📜</button>
                <button onClick={() => handleShareClick(item._id)} className="btn btn-secondary btn-sm">🔗</button>
                <button onClick={() => handleDelete(item._id, item.title)} className="btn btn-danger btn-sm">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showShareModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Share with User</h3>
            <div className="share-list">
              {shareUsers.map(u => (
                <button key={u._id} onClick={() => handleShare(showShareModal, u._id)} className="btn btn-secondary">
                  {u.username} ({u.role})
                </button>
              ))}
            </div>
            <button onClick={() => setShowShareModal(null)} className="btn btn-danger">Close</button>
          </div>
        </div>
      )}

      {showTimeline && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Access Timeline</h3>
            <div className="timeline">
              {timeline.map((t, i) => (
                <div key={i} className="timeline-item">
                  <span className="timeline-action">{t.action}</span>
                  <span className="timeline-user">{t.performedBy?.username}</span>
                  <span className="timeline-date">{new Date(t.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowTimeline(null)} className="btn btn-danger">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
