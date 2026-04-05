import { useState, useEffect } from 'react';
import { getFolders, createFolder, updateFolder, deleteFolder } from '../services/api';

export default function FolderManager() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#1a73e8' });

  const fetchFolders = async () => {
    try {
      const res = await getFolders();
      setFolders(res.data.folders);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFolders(); }, []);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createFolder(form);
      showMsg('Folder created!');
      setForm({ name: '', description: '', color: '#1a73e8' });
      setShowCreate(false);
      fetchFolders();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create folder');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await updateFolder(editingId, form);
      showMsg('Folder updated!');
      setEditingId(null);
      setForm({ name: '', description: '', color: '#1a73e8' });
      fetchFolders();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update folder');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete folder "${name}"? Items will be moved to root.`)) return;
    try {
      await deleteFolder(id);
      showMsg('Folder deleted');
      fetchFolders();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete folder');
    }
  };

  const startEdit = (folder) => {
    setEditingId(folder._id);
    setShowCreate(false);
    setForm({ name: folder.name, description: folder.description || '', color: folder.color });
  };

  if (loading) return <div className="loading">Loading folders...</div>;

  const COLORS = ['#1a73e8', '#e53935', '#43a047', '#fb8c00', '#8e24aa', '#00acc1', '#6d4c41', '#546e7a'];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>📁 Folder Manager</h1>
          <p className="subtitle">Organize your vault items into folders</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}>
          {showCreate ? 'Cancel' : '+ New Folder'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {(showCreate || editingId) && (
        <form onSubmit={editingId ? handleUpdate : handleCreate} className="store-form" style={{ marginBottom: '1.5rem' }}>
          <h3>{editingId ? 'Edit Folder' : 'Create New Folder'}</h3>
          <div className="form-group">
            <label>Folder Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Financial Records" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <button key={c} type="button" className={`color-swatch ${form.color === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => setForm({ ...form, color: c })} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowCreate(false); setEditingId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {folders.length === 0 ? (
        <div className="empty-state"><p>No folders yet. Create one to organize your vault items.</p></div>
      ) : (
        <div className="folder-grid">
          {folders.map(f => (
            <div key={f._id} className="folder-card" style={{ borderTopColor: f.color }}>
              <div className="folder-card-icon" style={{ color: f.color }}>📁</div>
              <h3>{f.name}</h3>
              {f.description && <p className="folder-desc">{f.description}</p>}
              <div className="folder-meta">
                <span>{f.itemCount || 0} items</span>
                {f.isDefault && <span className="badge-default">Default</span>}
              </div>
              <div className="folder-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => startEdit(f)}>Edit</button>
                {!f.isDefault && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f._id, f.name)}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
