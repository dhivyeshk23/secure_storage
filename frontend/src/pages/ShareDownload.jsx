import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getShareInfo } from '../services/api';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE = isLocalhost ? 'http://localhost:5000/api' : 'https://backend-one-blush-33.vercel.app/api';

export default function ShareDownload() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // { type, message }
  const [password, setPassword] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [countdown, setCountdown] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await getShareInfo(token);
        setInfo(res.data);
      } catch (err) {
        const status = err.response?.status;
        const message = err.response?.data?.error || 'This share link is not available.';
        if (status === 404) {
          setErrorState({ type: 'not-found', message });
        } else if (status === 410) {
          setErrorState({ type: 'expired', message });
        } else {
          setErrorState({ type: 'error', message });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [token]);

  // Countdown timer
  useEffect(() => {
    if (!info?.expiresAt) return;

    const update = () => {
      const diff = new Date(info.expiresAt) - new Date();
      if (diff <= 0) {
        setCountdown('Expired');
        setErrorState({ type: 'expired', message: 'This share link has expired.' });
        clearInterval(timerRef.current);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      if (d > 0) setCountdown(`${d}d ${h}h ${m}m ${s}s`);
      else if (h > 0) setCountdown(`${h}h ${m}m ${s}s`);
      else setCountdown(`${m}m ${s}s`);
    };

    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [info]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = new URL(`${API_BASE}/share/${token}`);
      if (password) url.searchParams.set('password', password);

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errData = await response.json();
        if (response.status === 401 && errData.requiresPassword) {
          setErrorState({ type: 'needs-password', message: errData.error });
          setDownloading(false);
          return;
        }
        throw new Error(errData.error || 'Download failed');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        const blob = await response.blob();
        const url2 = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = info?.fileName || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url2);
        a.remove();
      } else {
        // Text data
        const data = await response.json();
        const blob = new Blob([data.data], { type: 'text/plain' });
        const url2 = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = `${data.fileName || 'download'}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url2);
        a.remove();
      }

      setDownloaded(true);
      setErrorState(null);

      // Refresh info to update download count
      try {
        const res = await getShareInfo(token);
        setInfo(res.data);
      } catch { /* may be expired now */ }
    } catch (err) {
      setErrorState({ type: 'error', message: err.message });
    } finally {
      setDownloading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getFileIcon = (type) => {
    const icons = { text: '📝', pdf: '📄', image: '🖼️', audio: '🎵', video: '🎬', document: '📑', spreadsheet: '📊', archive: '📦' };
    return icons[type] || '📎';
  };

  if (loading) {
    return (
      <div className="share-page">
        <div className="share-container">
          <div className="share-loading">
            <div className="share-spinner"></div>
            <p>Loading shared file info...</p>
          </div>
        </div>
      </div>
    );
  }

  if (errorState && errorState.type !== 'needs-password') {
    return (
      <div className="share-page">
        <div className="share-container">
          <div className="share-error-card">
            <div className="share-error-icon">
              {errorState.type === 'expired' ? '⏰' : errorState.type === 'not-found' ? '🔍' : '❌'}
            </div>
            <h2>{errorState.type === 'expired' ? 'Link Expired' : errorState.type === 'not-found' ? 'Link Not Found' : 'Error'}</h2>
            <p>{errorState.message}</p>
            <div className="share-error-hint">
              {errorState.type === 'expired'
                ? 'This share link has expired or reached its download limit. Contact the file owner for a new link.'
                : errorState.type === 'not-found'
                ? 'This link may have been revoked or never existed.'
                : 'Something went wrong. Please try again later.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="share-page">
      <div className="share-container">
        <div className="share-download-card">
          {/* Header */}
          <div className="share-download-header">
            <div className="share-brand">
              <span className="brand-icon">🔐</span>
              <span>Secure Data Vault</span>
            </div>
            <div className="share-countdown-badge">
              <span className="countdown-dot"></span>
              {countdown}
            </div>
          </div>

          {/* File Info */}
          <div className="share-file-info">
            <div className="share-file-icon">{getFileIcon(info?.fileType)}</div>
            <h2 className="share-file-name">{info?.fileName || 'Shared File'}</h2>
            <p className="share-shared-by">Shared by <strong>{info?.sharedBy}</strong></p>
            {info?.label && <p className="share-label">"{info.label}"</p>}
          </div>

          {/* Meta Grid */}
          <div className="share-meta-grid">
            <div className="share-meta-item">
              <span className="share-meta-icon">📁</span>
              <span className="share-meta-label">Type</span>
              <span className="share-meta-value">{info?.fileType?.toUpperCase() || 'Unknown'}</span>
            </div>
            <div className="share-meta-item">
              <span className="share-meta-icon">📦</span>
              <span className="share-meta-label">Size</span>
              <span className="share-meta-value">{formatSize(info?.fileSize)}</span>
            </div>
            <div className="share-meta-item">
              <span className="share-meta-icon">📥</span>
              <span className="share-meta-label">Downloads</span>
              <span className="share-meta-value">{info?.downloadCount}{info?.maxDownloads > 0 ? ` / ${info.maxDownloads}` : ''}</span>
            </div>
            <div className="share-meta-item">
              <span className="share-meta-icon">⏱️</span>
              <span className="share-meta-label">Expires</span>
              <span className="share-meta-value">{countdown}</span>
            </div>
          </div>

          {/* Password input */}
          {(info?.hasPassword || errorState?.type === 'needs-password') && (
            <div className="share-password-section">
              <label>🔒 This file is password protected</label>
              <div className="share-password-row">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorState(null); }}
                  placeholder="Enter share password"
                  className="share-password-input"
                />
              </div>
              {errorState?.type === 'needs-password' && (
                <p className="share-password-error">{errorState.message}</p>
              )}
            </div>
          )}

          {/* Download Button */}
          <button
            className={`share-download-btn ${downloaded ? 'downloaded' : ''}`}
            onClick={handleDownload}
            disabled={downloading || (info?.hasPassword && !password)}
          >
            {downloading ? (
              <>
                <span className="share-spinner-sm"></span>
                Decrypting & Downloading...
              </>
            ) : downloaded ? (
              '✅ Downloaded Successfully!'
            ) : (
              <>📥 Download File</>
            )}
          </button>

          {downloaded && (
            <p className="share-download-again" onClick={() => setDownloaded(false)} style={{ cursor: 'pointer' }}>
              Click the button again to download once more
            </p>
          )}

          {/* Footer */}
          <div className="share-footer">
            <p>🔐 End-to-end encrypted · Shared securely via <strong>Secure Data Vault</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
