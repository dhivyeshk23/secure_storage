import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, Users, LogOut, ShieldCheck } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const Layout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch(e) {}
    logout();
    navigate('/login');
  };

  const isAdmin = user?.roles?.includes('Admin');
  const isSecurityManager = user?.roles?.includes('Security Manager');

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ...(isAdmin ? [{ name: 'Admin Console', path: '/admin', icon: Users }] : []),
    ...(isSecurityManager ? [{ name: 'Security Manager', path: '/security-manager', icon: ShieldCheck }] : []),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <div className="bg-primary p-2 rounded-lg">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="font-bold text-xl tracking-tight">SecureVault</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase">
              {(user?.name || user?.email)?.[0]}
            </div>
            <div className="text-sm overflow-hidden text-ellipsis whitespace-nowrap flex-1">
              <div className="font-medium">{user?.name || 'User'}</div>
              <div className="text-xs text-muted-foreground">{user?.roles?.join(', ')}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full mt-2 flex items-center gap-3 px-4 py-2 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md flex items-center px-6 md:hidden">
          <Shield className="w-6 h-6 text-primary mr-3" />
          <h1 className="font-bold text-lg">SecureVault</h1>
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
