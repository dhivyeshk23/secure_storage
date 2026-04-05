import { useState, useEffect } from 'react';
import { getAlerts, markAlertRead, markAllAlertsRead } from '../services/api';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAlerts = async () => {
    try {
      const res = await getAlerts();
      setAlerts(res.data.alerts);
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, []);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleMarkRead = async (id) => {
    try {
      await markAlertRead(id);
      setAlerts(alerts.map(a => a._id === id ? { ...a, isRead: true, readAt: new Date() } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      setError('Failed to mark alert as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAlertsRead();
      setAlerts(alerts.map(a => ({ ...a, isRead: true, readAt: new Date() })));
      setUnreadCount(0);
      showMsg('All alerts marked as read');
    } catch (err) {
      setError('Failed to mark all alerts as read');
    }
  };

  const severityColors = { low: '#4caf50', medium: '#ff9800', high: '#f44336', critical: '#9c27b0' };
  const severityIcons = { low: 'ℹ️', medium: '⚠️', high: '🔴', critical: '🚨' };
  const typeIcons = {
    suspicious_login: '🕵️', account_locked: '🔒', access_denied: '🚫',
    rate_limit_exceeded: '⏱️', key_rotation: '🔑', integrity_violation: '💔',
    critical_access: '⚡', new_device: '📱', off_hours_access: '🌙'
  };

  if (loading) return <div className="loading">Loading alerts...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>🔔 Security Alerts</h1>
          <p className="subtitle">
            {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={handleMarkAllRead}>Mark All Read</button>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {alerts.length === 0 ? (
        <div className="empty-state"><p>No security alerts. Your account is secure.</p></div>
      ) : (
        <div className="alert-list">
          {alerts.map(a => (
            <div key={a._id} className={`alert-card ${a.isRead ? 'alert-read' : 'alert-unread'}`} style={{ borderLeftColor: severityColors[a.severity] }}>
              <div className="alert-icon">{typeIcons[a.type] || '🔔'}</div>
              <div className="alert-content">
                <div className="alert-header">
                  <h4>{a.title}</h4>
                  <div className="alert-badges">
                    <span className="severity-badge" style={{ backgroundColor: severityColors[a.severity] + '30', color: severityColors[a.severity] }}>
                      {severityIcons[a.severity]} {a.severity.toUpperCase()}
                    </span>
                    {!a.isRead && <span className="unread-dot" />}
                  </div>
                </div>
                <p className="alert-message">{a.message}</p>
                <div className="alert-footer">
                  <span className="alert-time">{new Date(a.createdAt).toLocaleString()}</span>
                  {a.ipAddress && <span className="alert-ip">IP: {a.ipAddress}</span>}
                  {!a.isRead && (
                    <button className="btn btn-sm btn-secondary" onClick={() => handleMarkRead(a._id)}>Dismiss</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
