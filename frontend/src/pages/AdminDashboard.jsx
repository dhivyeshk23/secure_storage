import { useState, useEffect } from 'react';
import { getAdminStats, getKeyStatus, rotateKeys, getAuthorizedEmails, addAuthorizedEmail, removeAuthorizedEmail } from '../services/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [keyStatus, setKeyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [authEmails, setAuthEmails] = useState([]);
  const [newEmail, setNewEmail] = useState({ email: '', role: 'student' });
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, keyRes, emailRes] = await Promise.all([
          getAdminStats().catch(() => ({ data: null })),
          getKeyStatus().catch(() => ({ data: null })),
          getAuthorizedEmails().catch(() => ({ data: { emails: [] } }))
        ]);
        setStats(statsRes.data);
        setKeyStatus(keyRes.data);
        setAuthEmails(emailRes.data.emails || []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const handleRotateKeys = async () => {
    if (!window.confirm('Rotate all expired encryption keys?')) return;
    try {
      const res = await rotateKeys();
      showMsg(`Key rotation complete: ${res.data.results.rotated} rotated, ${res.data.results.failed} failed`);
      // Refresh key status
      const keyRes = await getKeyStatus();
      setKeyStatus(keyRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Key rotation failed');
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    try {
      const res = await addAuthorizedEmail(newEmail);
      setAuthEmails([res.data.email, ...authEmails]);
      setNewEmail({ email: '', role: 'student' });
      showMsg('Authorized email added successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add authorized email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleRemoveEmail = async (id, email) => {
    if (!window.confirm(`Are you sure you want to remove authorization for ${email}?`)) return;
    try {
      await removeAuthorizedEmail(id);
      setAuthEmails(authEmails.filter(e => e._id !== id));
      showMsg('Authorized email removed.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove authorized email');
    }
  };

  if (loading) return <div className="loading">Loading admin dashboard...</div>;

  return (
    <div className="page">
      <h1>⚙️ Admin Dashboard</h1>
      <p className="subtitle">System overview and management tools</p>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {/* System Stats */}
      {stats && (
        <>
          <div className="info-cards">
            <div className="info-card stat-card">
              <div className="stat-number">{stats.totalUsers}</div>
              <div className="stat-label">Total Users</div>
            </div>
            <div className="info-card stat-card">
              <div className="stat-number">{stats.totalVaultItems}</div>
              <div className="stat-label">Vault Items</div>
            </div>
            <div className="info-card stat-card">
              <div className="stat-number">{stats.totalEncryptionKeys}</div>
              <div className="stat-label">Encryption Keys</div>
            </div>
            <div className="info-card stat-card">
              <div className="stat-number">{stats.totalAuditLogs}</div>
              <div className="stat-label">Audit Logs</div>
            </div>
            <div className="info-card stat-card">
              <div className="stat-number">{stats.totalFolders}</div>
              <div className="stat-label">Folders</div>
            </div>
            <div className="info-card stat-card">
              <div className="stat-number">{stats.totalAlerts}</div>
              <div className="stat-label">Alerts</div>
            </div>
          </div>

          {/* Encryption Breakdown */}
          <div className="info-cards" style={{ marginTop: '1rem' }}>
            <div className="info-card">
              <h3>Encryption Strategy Distribution</h3>
              {stats.encryptionBreakdown?.length > 0 ? (
                <div className="breakdown-list">
                  {stats.encryptionBreakdown.map(item => (
                    <div key={item._id} className="breakdown-item">
                      <span className={`strategy-badge strategy-${(item._id || 'unknown').toLowerCase()}`}>
                        {item._id || 'N/A'}
                      </span>
                      <div className="breakdown-bar">
                        <div className="breakdown-fill" style={{ width: `${(item.count / stats.totalVaultItems) * 100}%` }} />
                      </div>
                      <span className="breakdown-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No data yet</p>
              )}
            </div>

            <div className="info-card">
              <h3>Sensitivity Level Distribution</h3>
              {stats.sensitivityBreakdown?.length > 0 ? (
                <div className="breakdown-list">
                  {stats.sensitivityBreakdown.map(item => (
                    <div key={item._id} className="breakdown-item">
                      <span className={`sensitivity-badge s-${(item._id || 'unknown').toLowerCase()}`}>
                        {item._id || 'N/A'}
                      </span>
                      <div className="breakdown-bar">
                        <div className="breakdown-fill" style={{ width: `${(item.count / stats.totalVaultItems) * 100}%` }} />
                      </div>
                      <span className="breakdown-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No data yet</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Key Management */}
      {keyStatus && (
        <div className="info-cards" style={{ marginTop: '1rem' }}>
          <div className="info-card">
            <h3>🔑 Key Management</h3>
            <div className="info-item"><strong>Rotation Interval:</strong> {keyStatus.rotation?.rotationIntervalDays || 90} days</div>
            <div className="info-item"><strong>Oldest Key Age:</strong> {keyStatus.rotation?.oldestKeyAgeDays || 0} days</div>
            <div className="info-item"><strong>Total Keys:</strong> {keyStatus.rotation?.totalKeys || 0}</div>
            <div className="info-item">
              <strong>Status:</strong>{' '}
              <span className={`status-badge ${keyStatus.rotation?.dueForRotation ? 'status-failed' : 'status-success'}`}>
                {keyStatus.rotation?.dueForRotation ? 'Rotation Needed' : 'Up to Date'}
              </span>
            </div>
            <button className="btn btn-warning" style={{ marginTop: '1rem' }} onClick={handleRotateKeys}>
              🔄 Rotate Expired Keys
            </button>
          </div>

          <div className="info-card">
            <h3>🛡️ Available Encryption Strategies</h3>
            {keyStatus.availableStrategies?.map(s => (
              <div key={s.name} className="info-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span className={`strategy-badge strategy-${s.name.toLowerCase()}`}>{s.name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{s.algorithm} ({s.keyLength})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authorized Registration Management */}
      <div className="info-cards" style={{ marginTop: '1rem', display: 'block' }}>
        <div className="info-card" style={{ width: '100%' }}>
          <h3>✉️ Authorized Registrations</h3>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Only emails listed below are permitted to register an account in the vault.
          </p>

          <form onSubmit={handleAddEmail} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <input 
              type="email" 
              placeholder="Enter email to authorize" 
              required
              value={newEmail.email}
              onChange={(e) => setNewEmail({...newEmail, email: e.target.value})}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
            />
            <select 
              value={newEmail.role}
              onChange={(e) => setNewEmail({...newEmail, role: e.target.value})}
              style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
            >
              <option value="student">Student</option>
              <option value="professor">Professor</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn btn-primary" disabled={emailLoading}>
              {emailLoading ? 'Adding...' : 'Add Allowed Email'}
            </button>
          </form>

          {authEmails.length > 0 ? (
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.5rem' }}>Email Address</th>
                    <th style={{ padding: '0.5rem' }}>Assigned Role</th>
                    <th style={{ padding: '0.5rem' }}>Authorizer</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {authEmails.map(auth => (
                    <tr key={auth._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem' }}>{auth.email}</td>
                      <td style={{ padding: '0.5rem' }}>{auth.role}</td>
                      <td style={{ padding: '0.5rem' }}>{auth.addedBy?.username || 'Unknown'}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        <button 
                          className="btn btn-sm btn-danger" 
                          onClick={() => handleRemoveEmail(auth._id, auth.email)}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No emails are currently authorized. Nobody can register!</p>
          )}
        </div>
      </div>
    </div>
  );
}
