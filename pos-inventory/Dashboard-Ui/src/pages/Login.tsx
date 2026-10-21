import {
    AlertCircle,
    ArrowRight,
    ChevronDown,
    Eye,
    EyeOff,
    Globe,
    Lock,
    Mail,
    Moon,
    Sparkles,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import atlasLogo from '../assets/LOGO.png';
import loginBg from '../assets/login_city_bg.jpg';

export const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const intendedDestination = (location.state as { from?: string })?.from || '/';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === 'admin') {
      authApi.login({ username: 'admin', password: 'Admin@123' }).then((res) => {
        if (res.user) {
          login(res.access_token, res.user);
          navigate('/', { replace: true });
        }
      }).catch(console.error);
    }
  }, [location.search]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        username: identifier.includes('@') ? undefined : identifier,
        email: identifier.includes('@') ? identifier : undefined,
        password,
      };

      const res = await authApi.login(data);
      if (res.user) {
        login(res.access_token, res.user);
        navigate(intendedDestination, { replace: true });
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = axiosError.response?.status;
      const detail = (axiosError.response?.data?.detail || '').toLowerCase();

      if (!axiosError.response) {
        setError('Connection error: Cannot reach the ATLAS backend. Please verify your connection.');
      } else if (status === 401 && detail.includes('deactivated')) {
        setError('Your employee account has been deactivated by an administrator. Please contact your manager or IT support.');
      } else if (status === 401) {
        setError('Invalid username/email or password. Please verify your credentials and try again.');
      } else if (status !== undefined && status >= 500) {
        setError('Server error: An unexpected error occurred on the authentication server. Please try again shortly.');
      } else {
        setError(axiosError.response?.data?.detail || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#edf3f8] text-slate-900 font-sans flex">
      
      {/* Left Sidebar - Expanded to cover more on the right */}
      <aside 
        className="relative hidden lg:flex flex-col justify-between h-full w-[56%] xl:w-[63%] 2xl:w-[66%] text-white px-10 xl:px-14 py-12"
        style={{ clipPath: 'polygon(0 0, 88% 0, 100% 100%, 0% 100%)' }}
      >
        <div className="absolute inset-0 z-0">
          <img src={loginBg} className="h-full w-full object-cover object-center" alt="ATLAS City Highway Operations" />
          {/* Subtle gradient so the illuminated city, skyscrapers, and glowing highway overpasses remain fully visible */}
          <div className="absolute inset-0 bg-[#060e20]/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050c1b]/80 via-transparent to-[#050c1b]/40" />
        </div>
        
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
            {/* Header Brand */}
            <div className="flex items-center gap-4">
              <img src={atlasLogo} alt="ATLAS" className="h-16 w-auto xl:h-20 object-contain drop-shadow-2xl shrink-0" />
              <div>
                <div className="text-[36px] xl:text-[44px] font-black leading-none tracking-wider text-white drop-shadow-md">ATLAS</div>
                <div className="text-[14px] xl:text-[15px] font-semibold tracking-wide text-sky-300 mt-1.5 drop-shadow-xs">Atlas Technosoft Pvt. Ltd.</div>
              </div>
            </div>
            
            {/* Value Proposition */}
            <div className="mt-10 max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-slate-950/50 px-3.5 py-1 text-[12px] font-semibold text-sky-200 backdrop-blur-md mb-4 shadow-md">
                <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                <span>Next-Gen Enterprise Suite</span>
              </div>
              <div className="text-[30px] xl:text-[36px] font-black tracking-tight text-white leading-tight drop-shadow-lg">
                Smart Operations <br />
                <span className="bg-gradient-to-r from-sky-200 via-blue-100 to-indigo-200 bg-clip-text text-transparent">
                  for a Better Tomorrow
                </span>
              </div>
              <p className="mt-4 text-[15px] font-medium text-slate-200/90 leading-relaxed max-w-[420px] drop-shadow-sm">
                Unified sales, real-time inventory tracking, and enterprise-grade multi-branch control.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <div className="rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 backdrop-blur-md shadow-lg max-w-md">
              <div className="text-[13.5px] font-medium italic text-slate-100 leading-snug drop-shadow-xs">
                “All your store operations, sales, and inventory unified in one powerful platform.”
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative z-10 overflow-y-auto">
        
        {/* Header Options */}
        <header className="absolute top-4 right-8 flex items-center gap-3 z-30">
          <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 shadow-sm border border-slate-200/80 hover:bg-slate-50 transition cursor-pointer">
            <Globe className="h-4 w-4 text-slate-500" />
            <span>English</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm border border-slate-200/80 hover:bg-slate-50 transition cursor-pointer" title="Toggle Theme">
            <Moon className="h-4 w-4" />
          </button>
        </header>

        {/* Login Card moved to the Right Side */}
        <div className="flex-1 flex items-center justify-center lg:justify-end px-6 sm:px-12 lg:pr-12 xl:pr-20 py-10">
          <div className="w-full max-w-[450px] rounded-3xl bg-white p-8 sm:p-9 shadow-[0_15px_50px_rgba(0,0,0,0.08)] border border-slate-100/90">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50/80 p-1.5 border border-blue-100 shadow-xs">
                  <img src={atlasLogo} alt="ATLAS" className="h-9 w-9 object-contain" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[26px] font-black tracking-wider text-[#0c1f3d] leading-none">ATLAS</span>
                </div>
              </div>

              <h1 className="mt-6 text-[30px] sm:text-[32px] font-black tracking-tight text-[#0b1f46]">Welcome Back</h1>
              <p className="mt-2 text-[14.5px] sm:text-[15px] font-medium text-slate-500 max-w-[340px]">
                Sign in to access your ATLAS dashboard and manage your operations.
              </p>
            </div>

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700 font-medium animate-in fade-in">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-4.5">
              <div>
                <label className="mb-1.5 block text-[13.5px] font-bold text-[#0b1f46]">Email or Username</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    type="text"
                    placeholder="Enter your email or username"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-[14.5px] font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13.5px] font-bold text-[#0b1f46]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-11 text-[14.5px] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 font-medium tracking-widest placeholder:tracking-normal text-slate-800"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[13.5px] font-semibold text-[#0b1f46] pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                  <span className="text-slate-600">Remember me</span>
                </label>
                <Link to="/register" className="text-blue-600 hover:underline font-bold">Forgot password?</Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-[15px] font-bold text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                <ArrowRight className="h-4.5 w-4.5" />
              </button>

              <button
                type="button"
                id="btn-demo-admin-login"
                onClick={() => {
                  setLoading(true);
                  authApi.login({ username: 'admin', password: 'Admin@123' }).then((res) => {
                    if (res.user) {
                      login(res.access_token, res.user);
                      navigate('/', { replace: true });
                    }
                  }).catch((err) => setError('Demo login failed: ' + String(err))).finally(() => setLoading(false));
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-700 text-[13px] font-bold hover:from-blue-100 hover:to-indigo-100 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Sparkles size={14} className="text-blue-600" />
                Quick Demo Admin Sign-In
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">Or continue with</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {['Google', 'Microsoft', 'SSO'].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[13.5px] font-bold text-slate-600 transition hover:bg-slate-50 hover:border-slate-300 cursor-pointer shadow-2xs"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-[#0b1f46]">
                    {label.charAt(0)}
                  </span>
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-7 text-center text-[13.5px] font-medium text-slate-500">
              Don’t have an account?{' '}
              <Link to="/register" className="font-bold text-blue-600 hover:underline">Create account</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

