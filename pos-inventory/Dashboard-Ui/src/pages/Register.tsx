import {
    AlertCircle,
    ChevronDown,
    Eye,
    EyeOff,
    Globe,
    Lock,
    Mail,
    Moon,
    Phone,
    Briefcase,
    Sparkles,
    User
} from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import atlasLogo from '../assets/LOGO.png';
import loginBg from '../assets/login_city_bg.jpg';

const JOB_ROLE_SUGGESTIONS = [
  'Cashier',
  'Sales Executive',
  'Inventory Manager',
  'Accountant',
  'Store Manager',
];

export const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    job_role: '',
    password: '',
    confirmPassword: '',
    role: 'user',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const trimmedJobRole = formData.job_role.trim();
    if (!trimmedJobRole) {
      setError('Please enter your job role / designation');
      return;
    }

    if (['admin', 'administrator', 'superadmin', 'system administrator'].includes(trimmedJobRole.toLowerCase())) {
      setError('Administrator roles cannot be registered through public registration.');
      return;
    }

    const cleanPhoneDigits = formData.phone.replace(/\D/g, '');
    if (cleanPhoneDigits.length < 7 || cleanPhoneDigits.length > 15) {
      setError('Please enter a valid phone number (7 to 15 digits, e.g. +91 98765 43210 or +1 555-0199)');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        job_role: trimmedJobRole,
        password: formData.password,
        role: 'user',
      };

      const res = await authApi.register(payload);
      if (res.user) {
        login(res.access_token, res.user);
        navigate('/');
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      if (!axiosError.response) {
        setError('Connection error: Cannot reach the server. Please ensure the backend is running.');
      } else {
        setError(axiosError.response.data?.detail || 'Registration failed. Please check your inputs.');
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

        {/* Registration Card moved to Right Side */}
        <div className="flex-1 flex items-center justify-center lg:justify-end px-4 sm:px-8 lg:pr-8 xl:pr-14 py-6">
          <div className="w-full max-w-[550px] rounded-3xl bg-white p-7 sm:p-8 shadow-[0_15px_50px_rgba(0,0,0,0.08)] border border-slate-100/90">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50/80 p-1.5 border border-blue-100 shadow-xs">
                    <img src={atlasLogo} alt="ATLAS" className="h-8 w-8 object-contain" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[24px] font-black tracking-wider text-[#0c1f3d] leading-none">ATLAS</span>
                  </div>
                </div>

                <h1 className="mt-4 text-[26px] sm:text-[28px] font-black tracking-tight text-[#0b1f46]">Create Your Account</h1>
                <p className="mt-1.5 text-[14px] font-medium text-slate-500 max-w-[400px]">
                  Join ATLAS and start managing your operations.
                </p>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13.5px] text-red-700 font-medium">
                  <AlertCircle className="mt-0.5 h-4.5 w-4.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
                <div className="grid gap-3.5 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[13.5px] font-bold text-[#0b1f46]">Full Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter your full name"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-[14px] font-medium outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9]"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[13.5px] font-bold text-[#0b1f46]">Email Address <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter your email address"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-[14px] font-medium outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9]"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3.5 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[13.5px] font-bold text-[#0b1f46]">Username <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="username"
                        type="text"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Choose a username"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-[14px] font-medium outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9]"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[13.5px] font-bold text-[#0b1f46]">Phone Number <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+91 98765 43210"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-[14px] font-medium outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9]"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[13.5px] font-bold text-[#0b1f46]">Job Role / Designation <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      name="job_role"
                      type="text"
                      list="job-role-suggestions"
                      value={formData.job_role}
                      onChange={handleChange}
                      placeholder="Enter your job role / designation (e.g. Cashier, Store Manager)"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-[14px] font-medium outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9]"
                      disabled={loading}
                      required
                    />
                    <datalist id="job-role-suggestions">
                      {JOB_ROLE_SUGGESTIONS.map((role) => (
                        <option key={role} value={role} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid gap-3.5 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[13.5px] font-bold text-[#0b1f46]">Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-[14px] outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9] font-medium tracking-widest placeholder:tracking-normal"
                        disabled={loading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[13.5px] font-bold text-[#0b1f46]">Confirm Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-[14px] outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9] font-medium tracking-widest placeholder:tracking-normal"
                        disabled={loading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="mt-1 text-[12.5px] text-slate-500 font-medium">Password must be at least 8 characters with letters, numbers and special characters.</p>

                <label className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-[#0b1f46] cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#0e6fe9] focus:ring-[#0e6fe9]" required />
                  <span>I agree to the Terms of Service and Privacy Policy</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c6ce8] py-3 text-[15px] font-bold text-white transition hover:bg-[#0b5fd0] disabled:opacity-70 shadow-sm cursor-pointer"
                >
                  <User className="h-4.5 w-4.5" />
                  <span>{loading ? 'Creating account...' : 'Create Account'}</span>
                </button>
              </form>

              <div className="mt-5 flex items-center justify-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Or continue with</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {['Google', 'Microsoft', 'SSO'].map((label) => (
                  <button
                    key={label}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[13.5px] font-bold text-slate-600 transition hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-[#0b1f46]">
                      {label.charAt(0)}
                    </span>
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-5 text-center text-[13.5px] font-medium text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-bold text-[#0e6fe9] hover:underline">Sign in</Link>
              </div>
            </div>
          </div>
      </main>
    </div>
  );
};
