import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/api';
import { useAuth } from '../context/AuthContext';

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  const checks = {
    length8: password.length >= 8,
    length12: password.length >= 12,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    noCommon: !['password', '123456', 'qwerty', 'admin', 'letmein'].some(c => password.toLowerCase().includes(c))
  };

  if (checks.length8) score += 1;
  if (checks.length12) score += 1;
  if (checks.lower) score += 1;
  if (checks.upper) score += 1;
  if (checks.number) score += 1;
  if (checks.symbol) score += 1;
  if (checks.noCommon) score += 1;

  if (score <= 2) return { score, label: 'Weak', color: '#f44336', width: '25%' };
  if (score <= 4) return { score, label: 'Fair', color: '#ff9800', width: '50%' };
  if (score <= 6) return { score, label: 'Strong', color: '#4caf50', width: '75%' };
  return { score, label: 'Very Strong', color: '#2e7d32', width: '100%' };
}

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    location: 'external'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const strength = getPasswordStrength(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (strength.score < 3) {
        setError('Please choose a stronger password (at least 8 characters with uppercase, lowercase, numbers, and symbols).');
        setLoading(false);
        return;
      }
      const res = await registerUser(form);
      const data = res.data;
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Register for Secure Data Vault</h2>
        <p className="auth-subtitle">Create your account</p>
        <div className="auth-note" style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          ⚠️ <strong>Note:</strong> Registration requires prior admin authorization. Ensure your email is whitelisted before creating an account.
        </div>
        {error && <div className="error-msg">{error}</div>}
        {loading && <div className="success-msg">Creating account...</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              placeholder="Choose a username"
              minLength={3}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              placeholder="Enter a strong password"
              minLength={6}
            />
            {form.password && (
              <div className="password-strength-container">
                <div className="password-strength-bar">
                  <div
                    className="password-strength-fill"
                    style={{ width: strength.width, backgroundColor: strength.color }}
                  />
                </div>
                <span className="password-strength-label" style={{ color: strength.color }}>
                  {strength.label} ({strength.score}/7)
                </span>
              </div>
            )}
              {form.password && strength.score < 3 && (
              <div className="password-requirements">
                <small>Password should include:</small>
                <ul>
                  {!/[a-z]/.test(form.password) && <li>Lowercase letter</li>}
                  {!/[A-Z]/.test(form.password) && <li>Uppercase letter</li>}
                  {/\d/.test(form.password) === false && <li>Number</li>}
                  {!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password) && <li>Special character</li>}
                  {form.password.length < 8 && <li>At least 8 characters</li>}
                </ul>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Location context</label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              >
                <option value="internal">Internal</option>
                <option value="external">External</option>
                <option value="remote">Remote</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        <p className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
