import {
    AlertCircle,
    Check,
    Eye,
    EyeOff,
    Globe,
    Lock,
    Mail,
    Moon,
    ShoppingBag,
    Sparkles,
    User
} from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import posBg from '../assets/pos_bg_clear.jpg';

const benefitItems = [
  { title: 'Set up your store', subtitle: 'Configure your store details and preferences', icon: User },
  { title: 'Start selling faster', subtitle: 'Manage sales, invoices and payments', icon: ShoppingBag },
  { title: 'Control your inventory', subtitle: 'Keep stock in sync across branches', icon: Check },
  { title: 'Access real insights', subtitle: 'Make data driven decisions to grow your business', icon: Sparkles },
];

export const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
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

    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
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
      
      {/* Left Sidebar */}
      <aside 
        className="relative hidden lg:flex flex-col justify-between h-full w-[40%] text-slate-900 px-10 py-12"
        style={{ clipPath: 'polygon(0 0, 85% 0, 100% 100%, 0% 100%)' }}
      >
        <div className="absolute inset-0 z-0">
          <img src={posBg} className="h-full w-full object-cover" alt="" />
          <div className="absolute inset-0 bg-[#0a1e3a]/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071324]/90 via-transparent to-transparent" />
        </div>
        
        <div className="relative z-10 flex flex-col h-full">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0e6fe9] shadow-lg">
                <div className="relative h-6 w-6">
                  <div className="absolute left-0 top-0 h-4 w-2 rounded-full bg-white rotate-[-40deg]" />
                  <div className="absolute right-0 top-0 h-4 w-2 rounded-full bg-white rotate-[40deg]" />
                  <div className="absolute inset-x-1 bottom-0 h-1.5 rounded-full bg-sky-200" />
                </div>
              </div>
              <div>
                <div className="text-[32px] font-black leading-none tracking-tight">Atls</div>
                <div className="text-[14px] font-medium tracking-wide text-slate-700">POS Inventory</div>
              </div>
            </div>
            
            <div className="mt-12">
              <div className="text-[22px] font-bold tracking-tight text-slate-900/95 leading-snug">
                Smart Retail Operations <br />for a Better Tomorrow
              </div>

              <div className="mt-8 space-y-6">
                {[
                  { label: 'Manage Sales & Invoices', description: 'Fast, accurate and reliable', icon: ShoppingBag },
                  { label: 'Track Inventory in Real Time', description: 'Always in control', icon: Sparkles },
                  { label: 'Grow Your Business', description: 'Data driven insights', icon: Check },
                  { label: 'Secure and Role Based Access', description: 'Your data stays protected', icon: Check },
                  { label: 'Multi-Branch Support', description: 'Built for growing retailers', icon: Globe },
                ].map(({ label, description, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-4 text-slate-900/90">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                      <Icon className="h-5 w-5 text-slate-700" />
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold leading-tight text-slate-900">{label}</div>
                      <div className="text-[12px] text-slate-500 mt-0.5">{description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto pb-4">
            <div className="text-[18px] font-medium italic text-slate-500 leading-snug">
              “All your store operations, <br />in one powerful platform.”
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative z-10 -ml-[5%] lg:ml-0 overflow-y-auto">
        
        {/* Header Options */}
        <header className="absolute top-4 right-6 flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
            <Globe className="h-4 w-4" />
            <span className="font-medium">English</span>
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M5.25 7.5 10 12.25 14.75 7.5H5.25Z" /></svg>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
            <Moon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center px-4 lg:px-0 py-10">
          <div className="flex flex-col xl:flex-row items-center justify-center gap-6 w-full max-w-[1000px]">
            
            {/* Registration Card */}
            <div className="w-full max-w-[600px] rounded-3xl bg-white p-8 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-3">
                  <div className="text-[#0e6fe9]">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 0C8.954 0 0 8.954 0 20C0 31.046 8.954 40 20 40C31.046 40 40 31.046 40 20C40 8.954 31.046 0 20 0Z" fill="#EDF3FF"/>
                      <path d="M15.5 11L11 20L15.5 29H18L13.5 20L18 11H15.5Z" fill="#0E6FE9"/>
                      <path d="M24.5 11L29 20L24.5 29H22L26.5 20L22 11H24.5Z" fill="#0E6FE9"/>
                    </svg>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[24px] font-black tracking-tight text-[#0c1f3d] leading-none">Atls</span>
                    <span className="text-[11px] font-bold text-[#0c1f3d]">POS Inventory</span>
                  </div>
                </div>

                <h1 className="mt-6 text-[28px] font-black tracking-tight text-[#0b1f46]">Create Your Account</h1>
                <p className="mt-2 text-[14px] text-slate-500 max-w-[400px]">
                  Join Atls POS Inventory and start managing your retail operations.
                </p>
              </div>

              {error && (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-bold text-[#0b1f46]">Full Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter your full name"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9]"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-bold text-[#0b1f46]">Email Address <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter your email address"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9]"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-bold text-[#0b1f46]">Username <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="Choose a username"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9]"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-bold text-[#0b1f46]">Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-sm outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9] font-medium tracking-widest placeholder:tracking-normal"
                        disabled={loading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-bold text-[#0b1f46]">Confirm Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-sm outline-none transition focus:border-[#0e6fe9] focus:ring-1 focus:ring-[#0e6fe9] font-medium tracking-widest placeholder:tracking-normal"
                        disabled={loading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="mt-1 text-[12px] text-slate-500 font-medium">Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.</p>

                <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[#0b1f46] cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#0e6fe9] focus:ring-[#0e6fe9]" required />
                  <span>I agree to the Terms of Service and Privacy Policy</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c6ce8] py-3.5 text-[15px] font-bold text-white transition hover:bg-[#0b5fd0] disabled:opacity-70"
                >
                  <User className="h-4 w-4" />
                  <span>{loading ? 'Creating account...' : 'Create Account'}</span>
                </button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Or continue with</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {['Google', 'Microsoft', 'SSO'].map((label) => (
                  <button
                    key={label}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-[#0b1f46]">
                      {label.charAt(0)}
                    </span>
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-8 text-center text-[13px] font-medium text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-bold text-[#0e6fe9] hover:underline">Sign in</Link>
              </div>
            </div>

            {/* Registration Promo Card (Right) */}
            <div className="hidden xl:block w-[320px] rounded-3xl bg-white p-8 shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-slate-100">
              <h2 className="text-[22px] font-black tracking-tight text-[#0b1f46]">Why Join Atls?</h2>
              <p className="mt-2 text-[13px] font-medium text-slate-500">Create your account to get started with modern retail operations.</p>

              <div className="mt-8 space-y-6">
                {benefitItems.map(({ title, subtitle, icon: Icon }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf3ff] text-[#0e6fe9]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="pt-0.5">
                      <div className="text-[14px] font-bold text-[#0b1f46]">{title}</div>
                      <div className="mt-0.5 text-[12px] font-medium text-slate-500">{subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
                <span className="flex items-center gap-3 text-[14px] font-bold text-[#0b1f46]">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Your data is secure
                </span>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};
