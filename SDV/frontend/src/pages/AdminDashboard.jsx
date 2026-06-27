import { useState, useEffect } from 'react';
import { Shield, Users, Check, X, Loader2, HardDrive, FileText, Trash2, AlertTriangle, Search, Flag, ArrowLeft, Activity } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const AdminDashboard = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.roles?.includes('Admin');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [dbStats, setDbStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);

  // User detail state
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivities, setUserActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const promises = [api.get('/admin/stats')];
      if (isAdmin) {
        promises.push(api.get('/admin/pending-users'));
        promises.push(api.get('/admin/all-users'));
      }
      const results = await Promise.all(promises);
      setDbStats(results[0].data);
      if (isAdmin) {
        setPendingUsers(results[1].data);
        setAllUsers(results[2].data);
      }
    } catch (error) {
      toast.error('Failed to fetch admin data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (userId, roleName) => {
    try {
      await api.post('/admin/approve-user', { userId, roleName });
      toast.success('User approved successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Approval failed');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User account deleted');
      setDeleteModal(null);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Delete failed');
    }
  };

  const handleSelectUser = async (u) => {
    setSelectedUser(u);
    setLoadingActivities(true);
    try {
      const res = await api.get('/admin/logs');
      // Filter logs for this user
      const userLogs = res.data.filter(log => log.userId === u.id);
      setUserActivities(userLogs);
    } catch (e) {
      toast.error('Failed to load user activity');
      setUserActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const stats = [
    { name: 'Total Users', value: dbStats?.totalUsers || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: 'Total Encrypted Files', value: dbStats?.totalFiles || 0, icon: FileText, color: 'text-green-500', bg: 'bg-green-500/10' },
    { name: 'Storage Used (MB)', value: dbStats ? (Number(dbStats.storageUsed) / (1024 * 1024)).toFixed(2) : '0', icon: HardDrive, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { name: 'Security Events', value: dbStats?.securityEvents || 0, icon: Shield, color: 'text-red-500', bg: 'bg-red-500/10' },
  ];

  const filteredUsers = allUsers.filter(u =>
    (u.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ─── USER DETAIL VIEW ──────────────────────────────────────────────
  if (selectedUser) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Admin Console
        </button>

        {/* User Header Card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-xl font-bold">
                {(selectedUser.name || selectedUser.email)?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold">{selectedUser.name || 'Unnamed'}</h2>
                <p className="text-muted-foreground text-sm">{selectedUser.email}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {(selectedUser.roles || []).map(r => (
                    <span key={r} className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{r}</span>
                  ))}
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${selectedUser.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : selectedUser.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                    {selectedUser.status}
                  </span>
                </div>
              </div>
            </div>
            {selectedUser.id !== user?.id && !(selectedUser.roles || []).includes('Admin') && (
              <button onClick={() => setDeleteModal(selectedUser)}
                className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive hover:text-destructive-foreground text-sm font-medium transition-colors">
                <Trash2 className="w-4 h-4" /> Remove Account
              </button>
            )}
          </div>

          {/* Flag alert */}
          {selectedUser.flag && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-500">Flagged by Security Manager</p>
                <p className="text-xs text-red-400">{selectedUser.flag.reason} — {new Date(selectedUser.flag.flaggedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Files', value: selectedUser.fileCount ?? 0, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Activity Events', value: userActivities.length, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'Joined', value: new Date(selectedUser.createdAt).toLocaleDateString(), icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              <div className={`p-3 rounded-full ${s.bg}`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              <div><p className="text-muted-foreground text-xs font-medium">{s.label}</p><h4 className="text-xl font-bold">{s.value}</h4></div>
            </div>
          ))}
        </div>

        {/* Activity Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <h3 className="font-medium flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> User Activity</h3>
            <span className="text-xs text-muted-foreground">{userActivities.length} event{userActivities.length !== 1 ? 's' : ''}</span>
          </div>
          {loadingActivities ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
          ) : userActivities.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No activity recorded for this user.</div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/10 sticky top-0">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">IP Address</th>
                    <th className="px-6 py-3">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {userActivities.map(a => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">{new Date(a.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-3 font-medium">{a.action}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : a.status === 'FAILED' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{a.ipAddress || '—'}</td>
                      <td className="px-6 py-3 text-muted-foreground text-xs max-w-[200px] truncate" title={a.device || ''}>{a.device || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteModal(null)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Delete Account</h3>
                <button onClick={() => setDeleteModal(null)} className="p-1 hover:bg-muted rounded-md"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-muted-foreground mb-2">Are you sure you want to permanently delete the account for:</p>
              <div className="bg-muted/30 border border-border rounded-lg p-3 mb-4">
                <p className="font-medium">{deleteModal.name || 'Unnamed'}</p>
                <p className="text-sm text-muted-foreground">{deleteModal.email}</p>
              </div>
              <p className="text-xs text-red-400 mb-4">This action is irreversible. All files, keys, and data associated with this user will be permanently deleted.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button onClick={() => handleDeleteUser(deleteModal.id)} className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── MAIN ADMIN VIEW ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-2 rounded-lg"><Shield className="w-6 h-6 text-white" /></div>
            Admin Console
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage users, monitor system statistics</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-card border border-border rounded-xl p-6 flex items-center gap-4 hover:border-primary/30 transition-colors">
              <div className={`p-4 rounded-full ${stat.bg}`}><Icon className={`w-6 h-6 ${stat.color}`} /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">{stat.name}</p>
                <h4 className="text-2xl font-bold">{stat.value}</h4>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Approvals */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <h3 className="font-medium">Pending Approvals</h3>
            <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full font-semibold">{pendingUsers.length} Pending</span>
          </div>
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
          ) : pendingUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No pending users requiring approval.</div>
          ) : (
            <div className="divide-y divide-border">
              {pendingUsers.map((pu) => (
                <div key={pu.id} className="p-6 flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{pu.email[0].toUpperCase()}</div>
                    <div>
                      <p className="font-medium">{pu.name || 'User'} <span className="text-muted-foreground font-normal ml-2">{pu.email}</span></p>
                      <p className="text-sm text-muted-foreground">Requested: {new Date(pu.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <select id={`role-${pu.id}`} className="bg-input/50 border border-border rounded-md text-sm px-3 py-2 mr-2" defaultValue="User">
                      <option value="User">User</option>
                      <option value="Security Manager">Security Manager</option>
                    </select>
                    <button onClick={() => { const roleName = document.getElementById(`role-${pu.id}`).value; handleApprove(pu.id, roleName); }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium transition-colors">
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button className="flex items-center justify-center w-10 h-10 bg-destructive/10 text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Accounts with Flags */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">User Accounts</h3>
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Search accounts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-card border border-border rounded-md py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click on a user to view their activity</p>
          </div>
          <div className="overflow-x-auto max-h-[32rem]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/10 sticky top-0">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Roles</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Flag</th>
                  <th className="px-6 py-3">Files</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} onClick={() => handleSelectUser(u)} className="border-b border-border/50 hover:bg-muted/10 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-primary text-xs font-bold">
                          {(u.name || u.email)?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{u.name || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {(u.roles || []).map(r => (
                          <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{r}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : u.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.flag ? (
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                            <Flag className="w-3 h-3" /> Flagged
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{u.fileCount}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      {u.id !== user?.id && !(u.roles || []).includes('Admin') && (
                        <button onClick={(e) => { e.stopPropagation(); setDeleteModal(u); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-destructive/10 text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground text-xs font-medium transition-colors">
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && !isLoading && (
              <div className="p-8 text-center text-muted-foreground">No user accounts found.</div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Delete Account</h3>
              <button onClick={() => setDeleteModal(null)} className="p-1 hover:bg-muted rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-2">Are you sure you want to permanently delete the account for:</p>
            <div className="bg-muted/30 border border-border rounded-lg p-3 mb-4">
              <p className="font-medium">{deleteModal.name || 'Unnamed'}</p>
              <p className="text-sm text-muted-foreground">{deleteModal.email}</p>
            </div>
            <p className="text-xs text-red-400 mb-4">This action is irreversible. All files, keys, and data associated with this user will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleDeleteUser(deleteModal.id)} className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
