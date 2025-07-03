import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { LogIn, Eye, EyeOff } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!credentials.username || !credentials.password) {
      toast.error('Please enter username and password');
      return;
    }

    setLoading(true);
    
    try {
      const result = await onLogin(credentials);
      
      if (result.success) {
        toast.success('Login successful');
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <LogIn className="login-icon" size={32} />
          <h1>Construction Dispatch</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              placeholder="Enter your username"
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                placeholder="Enter your password"
                disabled={loading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="demo-accounts">
            <h3>Demo Accounts</h3>
            <div className="demo-account-list">
              <div className="demo-account">
                <strong>Admin:</strong> admin / admin123
              </div>
              <div className="demo-account">
                <strong>Dispatcher:</strong> dispatcher1 / admin123
              </div>
              <div className="demo-account">
                <strong>Driver:</strong> driver1 / admin123
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;