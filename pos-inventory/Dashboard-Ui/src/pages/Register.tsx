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
    <div className="h-screen overflow-hidden bg-[#eef3f9] text-slate-900">
      <div className="flex h-screen w-full overflow-hidden">
        <aside className="relative hidden h-screen w-[36%] flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(134,180,255,0.18),_transparent_35%),linear-gradient(180deg,#0b254d_0%,#0b1d3a_48%,#071a2d_100%)] px-6 py-5 lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_35%,rgba(59,130,246,0.06))]" />
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0d438c] shadow-[0_0_30px_rgba(59,130,246,0.28)]">
                <div className="relative h-9 w-9">
                  <div className="absolute left-0 top-0 h-7 w-3 rounded-[10px] bg-white/90 rotate-[-42deg]" />
                  <div className="absolute right-0 top-0 h-7 w-3 rounded-[10px] bg-white/90 rotate-[42deg]" />
                  <div className="absolute inset-x-2 bottom-0 h-2 rounded-full bg-[#7dd3fc]" />
                </div>
              </div>
              <div className="text-[58px] font-black leading-none tracking-[-0.06em] text-white">Atls</div>
            </div>
            <div className="mt-4 ml-2 text-[18px] font-medium tracking-[-0.04em] text-sky-100/90">POS Inventory</div>
          </div>

          <div className="relative z-10 mt-6 space-y-4 pl-2 text-white">
            <div className="text-[18px] font-semibold tracking-[-0.04em] text-white/95">Smart Retail Operations <br />for a Better Tomorrow</div>

            <div className="space-y-3 pt-1">
              {[
                { label: 'Manage Sales & Invoices', description: 'Fast, accurate and reliable', icon: ShoppingBag },
                { label: 'Track Inventory in Real Time', description: 'Always in control', icon: Sparkles },
                { label: 'Grow Your Business', description: 'Data driven insights', icon: Check },
                { label: 'Secure and Role Based Access', description: 'Your data stays protected', icon: Check },
                { label: 'Multi-Branch Support', description: 'Built for growing retailers', icon: Globe },
              ].map(({ label, description, icon: Icon }) => (
                <div key={label} className="flex items-center gap-4 text-white/90">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10 shadow-inner shadow-sky-500/10">
                    <Icon className="h-5 w-5 text-sky-100" />
                  </div>
                  <div>
                    <div className="text-[17px] font-medium leading-tight text-white">{label}</div>
                    <div className="text-[12px] text-sky-100/75">{description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-4 space-y-3 px-2">
            <div className="text-[22px] font-medium italic text-sky-100/90">“All your store operations, <br />in one powerful platform.”</div>
            <div className="mt-3 h-[150px] rounded-t-[22px] border border-sky-300/15 bg-[radial-gradient(circle_at_top,_rgba(147,197,253,0.25),_rgba(5,12,30,0.2)_50%,rgba(2,6,23,0.6)_100%)] shadow-[0_0_40px_rgba(14,116,144,0.22)]">
              <div className="relative flex h-full items-end justify-center p-4">
                <div className="absolute inset-x-0 bottom-0 h-20 bg-[radial-gradient(circle_at_center,_rgba(32,103,173,0.4),_transparent_60%)]" />
                <div className="relative h-32 w-56 rounded-[18px] border border-sky-200/20 bg-[linear-gradient(180deg,#0b264f,#071d36)] shadow-2xl shadow-sky-950/40">
                  <div className="flex h-full flex-col">
                    <div className="h-10 rounded-t-[18px] border-b border-sky-200/10 bg-sky-500/10" />
                    <div className="grid flex-1 grid-cols-3 gap-2 p-3">
                      <div className="rounded-md bg-sky-500/20" />
                      <div className="rounded-md bg-sky-500/20" />
                      <div className="rounded-md bg-sky-500/20" />
                      <div className="rounded-md bg-sky-500/20" />
                      <div className="rounded-md bg-sky-500/20" />
                      <div className="rounded-md bg-sky-500/20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex h-screen flex-1 flex-col bg-[#edf3f8] px-4 py-2 sm:px-6 xl:px-8">
          <header className="flex items-center justify-end gap-3 pb-1 pt-1">
            <div className="flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/60 px-3 py-2 text-sm text-slate-700 shadow-sm shadow-slate-200/60 backdrop-blur-sm">
              <Globe className="h-4 w-4 text-slate-600" />
              <span>English</span>
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current text-slate-600" aria-hidden="true"><path d="M5.25 7.5 10 12.25 14.75 7.5H5.25Z" /></svg>
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300/70 bg-white/60 text-slate-700 shadow-sm shadow-slate-200/60 backdrop-blur-sm" aria-label="Light mode">
              <Moon className="h-4 w-4" />
            </button>
          </header>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-[760px]">
              <div className="mx-auto w-full max-w-[620px] rounded-[26px] border border-slate-200/70 bg-[#f7f9fb] p-4 shadow-[0_25px_70px_rgba(148,163,184,0.15)] sm:p-5">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3ff] shadow-sm">
                    <div className="relative h-8 w-8">
                      <div className="absolute left-0 top-0 h-6 w-2.5 rounded-[8px] bg-[#0e6fe9] rotate-[-42deg]" />
                      <div className="absolute right-0 top-0 h-6 w-2.5 rounded-[8px] bg-[#0e6fe9] rotate-[42deg]" />
                    </div>
                  </div>
                  <div className="flex items-end gap-2 text-[#0c1f3d]">
                    <span className="text-[46px] font-black tracking-[-0.08em]">Atls</span>
                  </div>
                </div>
                <div className="mt-3 text-center text-[20px] font-medium tracking-[-0.06em] text-[#0c1f3d]">POS Inventory</div>

                <h1 className="mt-3 text-center text-[28px] font-black leading-none tracking-[-0.06em] text-[#0b1f46]">Create Your Account</h1>
                <p className="mt-1.5 text-center text-[13px] text-slate-500">Join Atls POS Inventory and start managing your retail operations.</p>

                {error && (
                  <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-4 space-y-2.5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[12px] font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          name="name"
                          type="text"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Enter your full name"
                          className="auth-input"
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[12px] font-medium text-slate-700">Email Address <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Enter your email address"
                          className="auth-input"
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-slate-700">Username <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        name="username"
                        type="text"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Choose a username"
                        className="auth-input"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[12px] font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="Create a password"
                          className="auth-input auth-input--password"
                          disabled={loading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[12px] font-medium text-slate-700">Confirm Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          placeholder="Confirm your password"
                          className="auth-input auth-input--password"
                          disabled={loading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          aria-label="Toggle confirm password visibility"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="mt-1 text-[12px] text-slate-500">Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.</p>

                  <label className="mt-1 flex items-center gap-2 text-[12px] text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" required />
                    <span>I agree to the Terms of Service and Privacy Policy</span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 flex w-full items-center justify-center gap-3 rounded-xl bg-[#0c6ce8] px-4 py-2.5 text-[16px] font-semibold text-white shadow-[0_12px_24px_rgba(12,108,232,0.35)] transition hover:bg-[#0b5fd0] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <User className="h-5 w-5" />
                    <span>{loading ? 'Creating account...' : 'Create Account'}</span>
                  </button>
                </form>

                <div className="mt-4 text-center text-[12px] uppercase tracking-[0.18em] text-slate-400">Or continue with</div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {['Google', 'Microsoft', 'SSO'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-[14px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{label.charAt(0)}</span>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 text-center text-[15px] text-slate-600">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">Sign in</Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="hidden h-screen w-[28%] items-center justify-center bg-[#edf3f8] p-4 xl:flex">
          <div className="w-full max-w-[360px] rounded-[24px] border border-sky-200 bg-[#dfeefc] p-5 shadow-[0_16px_40px_rgba(148,163,184,0.18)]">
            <h2 className="text-[28px] font-black tracking-[-0.06em] text-[#0b1f46]">Why Join Atls?</h2>
            <p className="mt-2 text-[16px] leading-6 text-slate-600">Create your account to get started with modern retail operations.</p>

            <div className="mt-5 space-y-4">
              {benefitItems.map(({ title, subtitle, icon: Icon }) => (
                <div key={title} className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#dcecff] text-[#0a5ed5] shadow-inner shadow-blue-200">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[20px] font-semibold text-[#0b1f46]">{title}</div>
                    <div className="text-[15px] text-slate-600">{subtitle}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-[18px] border border-sky-300 bg-[#dfeefc] p-3">
              <div className="flex items-center justify-between rounded-xl border border-sky-300 bg-white/20 px-4 py-4 text-[20px] font-semibold text-[#0c1f3d]">
                <span className="flex items-center gap-3">
                  <User className="h-5 w-5" />
                  Your data is secure
                </span>
                <Check className="h-5 w-5" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

