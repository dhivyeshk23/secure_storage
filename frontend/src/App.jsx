import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ThemeProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import StoreData from './pages/StoreData';
import VaultItems from './pages/VaultItems';
import AuditLogs from './pages/AuditLogs';
import Security from './pages/Security';
import FolderManager from './pages/FolderManager';
import LoginHistory from './pages/LoginHistory';
import Alerts from './pages/Alerts';
import AdminDashboard from './pages/AdminDashboard';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  return !user ? children : <Navigate to="/dashboard" />;
}

function AppRoutes() {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) return;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      const timeout = parseInt(user?.inactivityTimeout || 30) * 60 * 1000;
      timer = setTimeout(() => {
        alert('Session timed out due to inactivity.');
        logout();
        window.location.href = '/login';
      }, timeout);
    };
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, resetTimer)); };
  }, [user, logout]);

  return (
    <Router>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/store" element={<ProtectedRoute><StoreData /></ProtectedRoute>} />
          <Route path="/vault" element={<ProtectedRoute><VaultItems /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
          <Route path="/folders" element={<ProtectedRoute><FolderManager /></ProtectedRoute>} />
          <Route path="/login-history" element={<ProtectedRoute><LoginHistory /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          <Route path="/admin" element={user?.role === 'admin' ? (
            <ProtectedRoute><AdminDashboard /></ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )} />
          <Route path="/" element={<Navigate to="/register" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
