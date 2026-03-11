import axios from 'axios';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API = axios.create({
  baseURL: isLocalhost ? 'http://localhost:5000/api' : 'https://backend-one-blush-33.vercel.app/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser = (data) => API.post('/auth/login', data);
export const getMe = () => API.get('/auth/me');

// Vault - Store
export const storeData = (data) => API.post('/vault/store', data);
export const storePDF = (formData) => API.post('/vault/store/pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const storeNote = (data) => API.post('/vault/store/note', data);
export const storePassword = (data) => API.post('/vault/store/password', data);

// Vault - List & Search
export const getVaultItems = (params) => API.get('/vault/items', { params });
export const getCategories = () => API.get('/vault/categories');
export const getStats = () => API.get('/vault/stats');

// Vault - Retrieve & Actions
export const retrieveData = (id) => API.get(`/vault/retrieve/${id}`);
export const viewEncrypted = (id) => API.get(`/vault/view-encrypted/${id}`);
export const deleteVaultItem = (id) => API.delete(`/vault/delete/${id}`);
export const updateCategory = (id, category) => API.put(`/vault/category/${id}`, { category });

// Sharing
export const getShareUsers = () => API.get('/vault/share-users');
export const shareItem = (id, userId, canDecrypt) => API.post(`/vault/share/${id}`, { userId, canDecrypt });

// Timeline
export const getTimeline = (id) => API.get(`/vault/timeline/${id}`);

// Policy Simulator
export const simulatePolicy = (params) => API.get('/vault/policy-simulator', { params });

// Audit
export const getAuditLogs = (params) => API.get('/audit/logs', { params });
export const getAuditStats = () => API.get('/audit/stats');

export default API;
