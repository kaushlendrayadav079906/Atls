import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../app/hooks';
import { loginAsync } from '../features/auth/authSlice';
import { clearPersistedCache } from '../app/queryClient';
import { toast } from 'react-toastify';
import { handleError, handleSuccess } from '../utils/errorHandler';

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await dispatch(loginAsync(formData));
      if (loginAsync.fulfilled.match(result)) {
        // Clear any stale cache from a previous session before navigating
        queryClient.clear();
        clearPersistedCache();
        localStorage.removeItem('pos:operator-dashboard:v1');
        handleSuccess('User logged in successfully', 'Login');
        toast.success('Welcome back!');
        navigate('/');
      } else {
        const errorMsg = handleError(result.payload, 'Login');
        toast.error(errorMsg);
      }
    } catch (error) {
      const errorMsg = handleError(error, 'Login');
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-pink-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-60 h-30  rounded-2xl mb-4 p-4">
              <img
                src="/images/black-logo.png"
                alt="Retail POS Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">POS System</h1>
            <p className="text-gray-500 mt-2">Sign in to your account</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username or Email
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Enter your SAP username or email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-pink-500 hover:text-pink-600 font-semibold">
                Sign up
              </Link>
            </p>
          </div>

          {/* Demo Credentials */}
          {/* <div className="mt-6 p-4 bg-pink-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              <strong>Demo:</strong> Register a new account or use existing credentials
            </p>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Login;
