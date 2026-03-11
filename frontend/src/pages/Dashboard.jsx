import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStats } from '../services/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await getStats();
        setStats(statsRes.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const accessLevels = {
    admin: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    employee: ['LOW', 'MEDIUM', 'HIGH'],
    guest: ['LOW']
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const totalItems = stats?.totalItems || 0;

  return (
    <div className="dashboard">
      <h1>Welcome, {user.username}</h1>
      <p className="subtitle">Secure Data Vault - Context-Aware Encryption System</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-number">{totalItems}</div>
          <div className="stat-label">Total Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔒</div>
          <div className="stat-number">{stats?.byEncryption?.find(e => e._id === 'STRONG')?.count || 0}</div>
          <div className="stat-label">Strong Encryption</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📁</div>
          <div className="stat-number">{stats?.byCategory?.length || 0}</div>
          <div className="stat-label">Categories</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔑</div>
          <div className="stat-number">{stats?.byFileType?.find(f => f._id === 'password')?.count || 0}</div>
          <div className="stat-label">Passwords</div>
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <h3>By Sensitivity</h3>
          <div className="chart-bars">
            {stats?.bySensitivity?.map(item => (
              <div key={item._id} className="chart-bar-item">
                <span className="bar-label">{item._id}</span>
                <div className="bar-container">
                  <div className="bar" style={{ width: `${(item.count / totalItems) * 100 || 0}%`, backgroundColor: item._id === 'CRITICAL' ? '#e57373' : item._id === 'HIGH' ? '#ffb74d' : item._id === 'MEDIUM' ? '#64b5f6' : '#81c784' }}></div>
                </div>
                <span className="bar-value">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>By Category</h3>
          <div className="category-list">
            {stats?.byCategory?.slice(0, 5).map(item => (
              <div key={item._id} className="category-item">
                <span>📂 {item._id}</span>
                <span className="category-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Encryption</h3>
          <div className="encryption-pie">
            {stats?.byEncryption?.map(item => (
              <div key={item._id} className="encryption-item">
                <span className={`strategy-badge strategy-${item._id?.toLowerCase()}`}>{item._id}</span>
                <span>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>File Types</h3>
          <div className="file-types">
            {stats?.byFileType?.map(item => (
              <div key={item._id} className="file-type-item">
                <span>
                  {item._id === 'text' && '📝 Text'}
                  {item._id === 'pdf' && '📄 PDF'}
                  {item._id === 'note' && '📋 Note'}
                  {item._id === 'password' && '🔑 Password'}
                </span>
                <span className="file-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="info-cards">
        <div className="info-card">
          <h3>Your Access</h3>
          <div className="info-item"><strong>Role:</strong> <span className={`role-badge role-${user.role}`}>{user.role.toUpperCase()}</span></div>
          <div className="info-item"><strong>Location:</strong> {user.location}</div>
          <div className="info-item"><strong>Allowed:</strong></div>
          <div className="sensitivity-badges">
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(level => (
              <span key={level} className={`sensitivity-badge s-${level.toLowerCase()} ${!accessLevels[user.role]?.includes(level) ? 's-denied' : ''}`}>
                {level}
              </span>
            ))}
          </div>
        </div>

        <div className="info-card">
          <h3>Quick Actions</h3>
          <div className="quick-buttons">
            <a href="/store" className="btn btn-primary">+ Add Data</a>
            <a href="/store" className="btn btn-secondary">+ PDF</a>
            <a href="/store" className="btn btn-secondary">+ Note</a>
            <a href="/store" className="btn btn-secondary">+ Password</a>
          </div>
        </div>
      </div>

      <div className="encryption-info">
        <h3>Encryption Strategy</h3>
        <table className="data-table">
          <thead><tr><th>Strategy</th><th>Algorithm</th><th>Key</th><th>When</th></tr></thead>
          <tbody>
            <tr><td><span className="strategy-badge strategy-basic">BASIC</span></td><td>AES-128-CBC</td><td>128-bit</td><td>Low-risk</td></tr>
            <tr><td><span className="strategy-badge strategy-standard">STANDARD</span></td><td>AES-192-CBC</td><td>192-bit</td><td>Medium-risk</td></tr>
            <tr><td><span className="strategy-badge strategy-strong">STRONG</span></td><td>AES-256-GCM</td><td>256-bit</td><td>High-risk</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
