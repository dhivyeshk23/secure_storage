import axios from 'axios';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API = axios.create({
  baseURL: isLocalhost ? 'http://localhost:5000/api' : 'https://backend-one-blush-33.vercel.app/api',
});

// Attach token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth APIs ──────────────────────────────────────────────────────
export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser = (data) => API.post('/auth/login', data);
export const getMe = () => API.get('/auth/me');

// ─── Vault APIs ─────────────────────────────────────────────────────
export const storeData = (data) => API.post('/vault/store', data);
export const storeFile = (formData) => API.post('/vault/store/file', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getVaultItems = () => API.get('/vault/items');
export const retrieveData = (id, password) => {
  const params = password ? { password } : {};
  return API.get(`/vault/retrieve/${id}`, { params });
};
export const viewEncrypted = (id) => API.get(`/vault/view-encrypted/${id}`);
export const deleteVaultItem = (id) => API.delete(`/vault/delete/${id}`);

// ─── Audit APIs ─────────────────────────────────────────────────────
export const getAuditLogs = (params) => API.get('/audit/logs', { params });
export const getMyLogs = (params) => API.get('/audit/my-logs', { params });
export const getAuditStats = () => API.get('/audit/stats');

// ─── Security APIs ──────────────────────────────────────────────────
export const getSecurityStatus = () => API.get('/security/security-status');
export const getSessions = () => API.get('/security/sessions');
export const revokeSession = (id) => API.delete(`/security/sessions/${id}`);
export const revokeAllSessions = () => API.delete('/security/sessions');
export const updateIpWhitelist = (ips) => API.put('/security/ip-whitelist', { ipWhitelist: ips });

// ─── Advanced APIs ──────────────────────────────────────────────────
export const getLoginHistory = () => API.get('/advanced/login-history');
export const updateTheme = (theme) => API.put('/advanced/theme', { theme });
export const getSettings = () => API.get('/advanced/settings');
export const updateSettings = (data) => API.put('/advanced/settings', data);

// ─── Folder APIs ────────────────────────────────────────────────────
export const getFolders = () => API.get('/advanced/folders');
export const createFolder = (data) => API.post('/advanced/folders', data);
export const updateFolder = (id, data) => API.put(`/advanced/folders/${id}`, data);
export const deleteFolder = (id) => API.delete(`/advanced/folders/${id}`);

// ─── Alert APIs ─────────────────────────────────────────────────────
export const getAlerts = () => API.get('/advanced/alerts');
export const markAlertRead = (id) => API.put(`/advanced/alerts/${id}/read`);
export const markAllAlertsRead = () => API.put('/advanced/alerts/read-all');

// ─── Admin APIs ─────────────────────────────────────────────────────
export const getAdminStats = () => API.get('/advanced/admin/stats');
export const bulkCreateUsers = (users) => API.post('/advanced/admin/users/bulk', { users });
export const bulkDeleteUsers = (ids) => API.post('/advanced/admin/users/bulk-delete', { ids });

// ─── Key Management APIs ────────────────────────────────────────────
export const getKeyStatus = () => API.get('/keys/status');
export const rotateKeys = () => API.post('/keys/rotate');
export const getStrategies = () => API.get('/keys/strategies');

// ─── Share Link APIs ────────────────────────────────────────────────
export const createShareLink = (data) => API.post('/vault/share', data);
export const getShareLinks = (itemId) => API.get(`/vault/shares/${itemId}`);
export const getAllShareLinks = () => API.get('/vault/shares');
export const revokeShareLink = (linkId) => API.delete(`/vault/share/${linkId}`);
export const getShareInfo = (token) => API.get(`/share/${token}/info`);
export const downloadSharedFile = (token, password) => {
  const params = password ? { password } : {};
  return API.get(`/share/${token}`, { params, responseType: 'blob' });
};
// ─── Admin Authorized Emails APIs ─────────────────────────────────────
export const getAuthorizedEmails = () => API.get('/advanced/admin/authorized-emails');
export const addAuthorizedEmail = (data) => API.post('/advanced/admin/authorized-emails', data);
export const removeAuthorizedEmail = (id) => API.delete(`/advanced/admin/authorized-emails/${id}`);

export default API;
