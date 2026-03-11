import { useState, useRef, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE = isLocalhost ? 'http://localhost:5000/api' : 'https://backend-one-blush-33.vercel.app/api';

export default function StoreData() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('text');
  const [form, setForm] = useState({ title: '', data: '', sensitivityLevel: 'LOW', category: 'Personal', expiryDays: '' });
  const [noteForm, setNoteForm] = useState({ title: '', content: '', sensitivityLevel: 'LOW', category: 'Personal' });
  const [passForm, setPassForm] = useState({ title: '', username: '', password: '', website: '', category: 'Personal' });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  if (!user) return <div className="loading">Loading...</div>;

  const accessLevels = { admin: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], employee: ['LOW', 'MEDIUM', 'HIGH'], guest: ['LOW'] };
  const allowedLevels = accessLevels[user?.role] || ['LOW'];

  const categories = ['Personal', 'Work', 'Finance', 'Medical', 'Legal', 'Other'];

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < 16; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    setPassForm({ ...passForm, password });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    if (files.length > 10) { setError('Max 10 files allowed'); return; }
    setSelectedFiles(files);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      let res;
      if (activeTab === 'text') {
        res = await API.post('/vault/store', { ...form, expiryDays: form.expiryDays ? parseInt(form.expiryDays) : null });
      } else if (activeTab === 'pdf' && selectedFiles.length > 0) {
        const formData = new FormData();
        formData.append('title', form.title);
        formData.append('sensitivityLevel', form.sensitivityLevel);
        formData.append('category', form.category);
        if (form.expiryDays) formData.append('expiryDays', form.expiryDays);
        selectedFiles.forEach(f => formData.append('files', f));
        const token = localStorage.getItem('token');
        res = await fetch(`${API_BASE}/vault/store/pdf`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
        res = { data: await res.json() };
        if (!res.data.storedItems) throw new Error(res.data.error);
      } else if (activeTab === 'note') {
        res = await API.post('/vault/store/note', noteForm);
      } else if (activeTab === 'password') {
        res = await API.post('/vault/store/password', passForm);
      }
      setResult(res.data);
      setForm({ title: '', data: '', sensitivityLevel: 'LOW', category: 'Personal', expiryDays: '' });
      setNoteForm({ title: '', content: '', sensitivityLevel: 'LOW', category: 'Personal' });
      setPassForm({ title: '', username: '', password: '', website: '', category: 'Personal' });
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to store');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Store Data Securely</h1>
      <p className="subtitle">Encrypt & store text, PDFs, notes, or passwords with context-aware encryption</p>

      <div className="store-tabs">
        {['text', 'pdf', 'note', 'password'].map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'text' && '📝 Text'}
            {tab === 'pdf' && '📄 PDF'}
            {tab === 'note' && '📋 Note'}
            {tab === 'password' && '🔑 Password'}
          </button>
        ))}
      </div>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleSubmit} className="store-form">
        <div className="form-row">
          <div className="form-group">
            <label>Title</label>
            <input type="text" value={activeTab === 'text' ? form.title : activeTab === 'note' ? noteForm.title : passForm.title} 
              onChange={e => activeTab === 'text' ? setForm({...form, title: e.target.value}) : activeTab === 'note' ? setNoteForm({...noteForm, title: e.target.value}) : setPassForm({...passForm, title: e.target.value})}
              required placeholder="Enter title" />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={activeTab === 'text' ? form.category : activeTab === 'note' ? noteForm.category : passForm.category}
              onChange={e => activeTab === 'text' ? setForm({...form, category: e.target.value}) : activeTab === 'note' ? setNoteForm({...noteForm, category: e.target.value}) : setPassForm({...passForm, category: e.target.value})}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Sensitivity Level</label>
            <select value={activeTab === 'password' ? 'HIGH' : (activeTab === 'text' ? form.sensitivityLevel : noteForm.sensitivityLevel)}
              onChange={e => activeTab === 'text' ? setForm({...form, sensitivityLevel: e.target.value}) : setNoteForm({...noteForm, sensitivityLevel: e.target.value})}>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(l => <option key={l} value={l} disabled={!allowedLevels.includes(l)}>{l}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Auto-delete after (days, optional)</label>
            <input type="number" value={form.expiryDays} onChange={e => setForm({...form, expiryDays: e.target.value})} placeholder="Never" min="1" />
          </div>
        </div>

        {activeTab === 'text' && (
          <div className="form-group">
            <label>Data to Encrypt</label>
            <textarea value={form.data} onChange={e => setForm({...form, data: e.target.value})} required placeholder="Enter sensitive data..." rows={6} />
          </div>
        )}

        {activeTab === 'pdf' && (
          <div className="form-group">
            <label>Upload PDF Files (max 10)</label>
            <input type="file" ref={fileInputRef} accept="application/pdf" multiple onChange={handleFileChange} className="file-input" />
            {selectedFiles.length > 0 && <div className="selected-files">{selectedFiles.map(f => <span key={f.name} className="file-tag">{f.name}</span>)}</div>}
          </div>
        )}

        {activeTab === 'note' && (
          <div className="form-group">
            <label>Secure Note Content</label>
            <textarea value={noteForm.content} onChange={e => setNoteForm({...noteForm, content: e.target.value})} required placeholder="Write your secure note..." rows={8} />
          </div>
        )}

        {activeTab === 'password' && (
          <div className="form-group">
            <label>Password Details</label>
            <div className="password-form">
              <input type="text" value={passForm.username} onChange={e => setPassForm({...passForm, username: e.target.value})} placeholder="Username/Email" />
              <div className="password-input-group">
                <input type="password" value={passForm.password} onChange={e => setPassForm({...passForm, password: e.target.value})} required placeholder="Password" />
                <button type="button" className="btn btn-secondary" onClick={generatePassword}>🎲 Generate</button>
              </div>
              <input type="text" value={passForm.website} onChange={e => setPassForm({...passForm, website: e.target.value})} placeholder="Website (optional)" />
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Encrypting...' : `Encrypt & Store ${activeTab === 'pdf' ? `${selectedFiles.length} File(s)` : ''}`}
        </button>
      </form>

      {result && (
        <div className="result-card success">
          <h3>✅ Stored Successfully!</h3>
          <div className="result-details">
            {result.vaultItem && <div className="info-item"><strong>Title:</strong> {result.vaultItem.title}</div>}
            {result.storedItems && <div className="info-item"><strong>Files:</strong> {result.storedItems.length}</div>}
            <div className="info-item"><strong>Strategy:</strong> <span className={`strategy-badge ${activeTab === 'password' ? 'strategy-strong' : 'strategy-standard'}`}>{activeTab === 'password' ? 'STRONG' : 'STANDARD'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
