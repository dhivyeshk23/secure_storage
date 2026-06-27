import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FILE_TYPE_ICONS = {
  text: '📝', pdf: '📄', image: '🖼️', audio: '🎵', video: '🎬',
  document: '📑', spreadsheet: '📊', archive: '📦', other: '📎'
};

export { FILE_TYPE_ICONS };

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'nav-active' : '';

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard">
          <span className="brand-icon">🔐</span>
          <span className="brand-text">Secure Data Vault</span>
        </Link>
      </div>
      {user && (
        <div className="navbar-menu">
          <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
          <Link to="/store" className={isActive('/store')}>Store Data</Link>
          <Link to="/vault" className={isActive('/vault')}>My Vault</Link>
          <Link to="/shared-links" className={isActive('/shared-links')}>Shared</Link>
          <Link to="/folders" className={isActive('/folders')}>Folders</Link>
          <Link to="/security" className={isActive('/security')}>Security</Link>
          <Link to="/login-history" className={isActive('/login-history')}>History</Link>
          <Link to="/alerts" className={isActive('/alerts')}>Alerts</Link>
          {user.role === 'admin' && (
            <>
              <Link to="/audit" className={isActive('/audit')}>Audit</Link>
              <Link to="/admin" className={isActive('/admin')}>Admin</Link>
            </>
          )}
          <span className="user-info">
            <span className={`role-dot role-dot-${user.role}`}></span>
            {user.username}
          </span>
          <button onClick={handleLogout} className="btn btn-logout">Logout</button>
        </div>
      )}
    </nav>
  );
}
