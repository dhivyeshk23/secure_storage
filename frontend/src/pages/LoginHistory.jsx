import { useState, useEffect } from 'react';
import { getLoginHistory } from '../services/api';

export default function LoginHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await getLoginHistory();
        setHistory(res.data.history);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load login history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const deviceIcons = { desktop: '🖥️', mobile: '📱', tablet: '📋', unknown: '❓' };

  if (loading) return <div className="loading">Loading login history...</div>;

  return (
    <div className="page">
      <h1>🕐 Login History</h1>
      <p className="subtitle">Review your recent login activity for suspicious access.</p>
      {error && <div className="error-msg">{error}</div>}

      {history.length === 0 ? (
        <div className="empty-state"><p>No login history available.</p></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Device</th>
                <th>IP Address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h._id} className={h.status !== 'success' ? 'row-failed' : ''}>
                  <td>{new Date(h.loginTime).toLocaleString()}</td>
                  <td>
                    <span className="device-badge">
                      {deviceIcons[h.deviceType] || '❓'} {h.deviceType}
                    </span>
                  </td>
                  <td><code>{h.ipAddress}</code></td>
                  <td>
                    <span className={`status-badge ${h.status === 'success' ? 'status-success' : 'status-failed'}`}>
                      {h.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
