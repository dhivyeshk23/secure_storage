import { useState, useEffect } from 'react';
import { Shield, Users, ChevronRight, Flag, AlertTriangle, Key, RotateCcw, Settings, ToggleLeft, ToggleRight, Loader2, X, Clock, FileText, Activity, ArrowLeft, Search, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const SecurityManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [encryptionKeys, setEncryptionKeys] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [flagModal, setFlagModal] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/security-manager/users');
      setUsers(res.data);
    } catch (e) { toast.error('Failed to load users'); }
    finally { setIsLoading(false); }
  };

  const fetchUserDetails = async (userId) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/security-manager/users/${userId}`);
      setUserDetails(res.data);
      setSelectedUser(userId);
    } catch (e) { toast.error('Failed to load user details'); }
    finally { setIsLoading(false); }
  };

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/security-manager/encryption-keys');
      setEncryptionKeys(res.data);
    } catch (e) { toast.error('Failed to load keys'); }
    finally { setIsLoading(false); }
  };



  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedUser(null);
    setUserDetails(null);
    if (tab === 'keys') fetchKeys();

    else if (tab === 'users') fetchUsers();
  };

  const handleFlag = async () => {
    if (!flagModal) return;
    try {
      await api.post('/security-manager/flag-user', { userId: flagModal, reason: flagReason });
      toast.success('Account flagged');
      setFlagModal(null); setFlagReason('');
      if (selectedUser) fetchUserDetails(selectedUser); else fetchUsers();
    } catch (e) { toast.error('Failed to flag account'); }
  };

  const handleUnflag = async (userId) => {
    try {
      await api.post('/security-manager/unflag-user', { userId });
      toast.success('Flag removed');
      if (selectedUser) fetchUserDetails(selectedUser); else fetchUsers();
    } catch (e) { toast.error('Failed to unflag'); }
  };

  const handleRotateKey = async (keyId) => {
    try {
      await api.post(`/security-manager/rotate-key/${keyId}`);
      toast.success('Key rotated');
      fetchKeys();
    } catch (e) { toast.error('Failed to rotate key'); }
  };

  const handleRotateAll = async () => {
    if (!window.confirm('Rotate ALL encryption keys? This is a bulk operation.')) return;
    try {
      const res = await api.post('/security-manager/rotate-all-keys');
      toast.success(res.data.message);
      fetchKeys();
    } catch (e) { toast.error('Failed to rotate keys'); }
  };





  const filteredUsers = users.filter(u =>
    (u.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const tabs = [
    { id: 'users', label: 'Users & Monitoring', icon: Users },
    { id: 'keys', label: 'Encryption Keys', icon: Key },
  ];

  // ─── USER DETAIL VIEW ──────────────────────────────────────────────
  if (selectedUser && userDetails) {
    return (
      <div className="space-y-6">
        <button onClick={() => { setSelectedUser(null); setUserDetails(null); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </button>

        {/* User Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                {(userDetails.name || userDetails.email)?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold">{userDetails.name || 'Unnamed'}</h2>
                <p className="text-muted-foreground text-sm">{userDetails.email}</p>
                <div className="flex gap-2 mt-1">
                  {userDetails.roles?.map(r => (
                    <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{r}</span>
                  ))}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${userDetails.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {userDetails.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {userDetails.isFlagged ? (
                <button onClick={() => handleUnflag(userDetails.id)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                  <Shield className="w-4 h-4" /> Remove Flag
                </button>
              ) : (
                <button onClick={() => { setFlagModal(userDetails.id); setFlagReason(''); }} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
                  <Flag className="w-4 h-4" /> Flag Account
                </button>
              )}
            </div>
          </div>
          {userDetails.isFlagged && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-500">Account Flagged</p>
                <p className="text-xs text-red-400">{userDetails.flagDetails?.reason} — {new Date(userDetails.flagDetails?.flaggedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Files Owned', value: userDetails.ownedFiles?.length || 0, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Total Activities', value: userDetails.activities?.length || 0, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'Shared With', value: userDetails.shares?.length || 0, icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              <div className={`p-3 rounded-full ${s.bg}`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              <div><p className="text-muted-foreground text-xs font-medium">{s.label}</p><h4 className="text-2xl font-bold">{s.value}</h4></div>
            </div>
          ))}
        </div>

        {/* Files */}
        {userDetails.ownedFiles?.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30"><h3 className="font-medium">Files</h3></div>
            <div className="divide-y divide-border max-h-60 overflow-auto">
              {userDetails.ownedFiles.map(f => (
                <div key={f.id} className="px-6 py-3 flex justify-between items-center text-sm">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{f.originalFilename}</span>
                  </div>
                  <div className="flex gap-4 text-muted-foreground text-xs">
                    <span>{(Number(f.fileSize) / 1024).toFixed(1)} KB</span>
                    <span className="text-green-500">{f.encryptionAlgorithm}</span>
                    <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Log */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30"><h3 className="font-medium">Activity Log</h3></div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/10 sticky top-0">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {(userDetails.activities || []).map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap">{new Date(a.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-3 font-medium">{a.action}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{a.status}</span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{a.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!userDetails.activities || userDetails.activities.length === 0) && (
              <div className="p-8 text-center text-muted-foreground text-sm">No activity recorded.</div>
            )}
          </div>
        </div>

        {/* Flag Modal */}
        {flagModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setFlagModal(null)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /> Flag Account</h3>
                <button onClick={() => setFlagModal(null)} className="p-1 hover:bg-muted rounded-md"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Provide a reason for flagging this account as suspicious.</p>
              <textarea value={flagReason} onChange={e => setFlagReason(e.target.value)} placeholder="e.g., Multiple failed login attempts, unusual file access patterns..." rows={3}
                className="w-full bg-input/50 border border-border rounded-lg py-2 px-4 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none" />
              <button onClick={handleFlag} disabled={!flagReason.trim()}
                className="w-full bg-red-600 text-white font-medium py-2.5 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                Flag Account
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── MAIN TABS VIEW ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500 to-indigo-600 p-2 rounded-lg"><Shield className="w-6 h-6 text-white" /></div>
            Security Manager
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Monitor users, manage encryption keys & policies</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-border">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeTab === t.id ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      )}

      {/* ── USERS TAB ────────────────────────────────────────────── */}
      {!isLoading && activeTab === 'users' && (
        <div className="space-y-4">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <h3 className="font-medium">All Users</h3>
              <span className="text-xs text-muted-foreground">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No users found.</div>
            ) : (
              <div className="divide-y divide-border">
                {filteredUsers.map(u => (
                  <div key={u.id} onClick={() => fetchUserDetails(u.id)}
                    className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center text-primary font-bold">
                        {(u.name || u.email)?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{u.name || 'Unnamed'}</p>
                          {u.flag && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium"><AlertTriangle className="w-3 h-3" /> Flagged</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{u.email} • {u.roles?.join(', ') || 'No role'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">{u.fileCount} files • {u.activityCount} events</p>
                        <p className="text-xs text-muted-foreground">{u.status}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ENCRYPTION KEYS TAB ─────────────────────────────────── */}
      {!isLoading && activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={handleRotateAll} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
              <RefreshCw className="w-4 h-4" /> Rotate All Keys
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <h3 className="font-medium">Encryption Keys</h3>
              <span className="text-xs text-muted-foreground">{encryptionKeys.length} key{encryptionKeys.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/10 sticky top-0">
                  <tr>
                    <th className="px-6 py-3">File</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Algorithm</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {encryptionKeys.map(k => (
                    <tr key={k.id} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                      <td className="px-6 py-3 font-medium">{k.fileName}</td>
                      <td className="px-6 py-3 text-muted-foreground">{k.userEmail}</td>
                      <td className="px-6 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">{k.algorithm}</span></td>
                      <td className="px-6 py-3 text-muted-foreground text-xs">{new Date(k.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <button onClick={() => handleRotateKey(k.id)} className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-md hover:bg-primary/20 text-xs font-medium transition-colors">
                          <RotateCcw className="w-3 h-3" /> Rotate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {encryptionKeys.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No encryption keys found.</div>}
            </div>
          </div>
        </div>
      )}



      {/* Flag Modal (from users list) */}
      {flagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setFlagModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /> Flag Account</h3>
              <button onClick={() => setFlagModal(null)} className="p-1 hover:bg-muted rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <textarea value={flagReason} onChange={e => setFlagReason(e.target.value)} placeholder="Reason for flagging..." rows={3}
              className="w-full bg-input/50 border border-border rounded-lg py-2 px-4 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none" />
            <button onClick={handleFlag} disabled={!flagReason.trim()}
              className="w-full bg-red-600 text-white font-medium py-2.5 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
              Flag Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityManagerDashboard;
