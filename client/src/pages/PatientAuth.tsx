import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { api, userAuth } from '../api';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export default function PatientAuth() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    phone: '',
    gender: '',
  });

  useEffect(() => {
    if (userAuth.isLoggedIn() && userAuth.getRole() === 'patient') {
      navigate('/find-doctors', { replace: true });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.patientLogin(loginForm.email, loginForm.password);
      userAuth.save(res.accessToken, res.patient, 'patient', res.refreshToken);
      navigate('/find-doctors', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const res = await api.googleLogin(idToken, 'patient');
      userAuth.save(res.accessToken, res.patient, 'patient', res.refreshToken);
      navigate('/find-doctors', { replace: true });
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.registerPatient({
        name: regForm.name,
        email: regForm.email,
        password: regForm.password,
        age: regForm.age ? Number(regForm.age) : undefined,
        phone: regForm.phone,
        gender: regForm.gender,
      });
      userAuth.save(res.accessToken, res.patient, 'patient', res.refreshToken);
      navigate('/find-doctors', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-[#7A7570] hover:text-[#1C1C1C] mb-6 text-sm transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to options
        </Link>

        <div className="bg-white rounded-2xl border border-[#E8E3DA] overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-8 text-center border-b border-[#E8E3DA]">
            <div className="w-12 h-12 rounded-xl bg-[#EDF4EF] flex items-center justify-center mx-auto mb-4">
              <User2 className="w-6 h-6 text-[#4E9A6F]" />
            </div>
            <h2 className="text-2xl font-bold text-[#1C1C1C]">Patient Portal</h2>
            <p className="text-[#7A7570] text-sm mt-1">Start your wellness journey</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#E8E3DA]">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                tab === 'login'
                  ? 'text-[#4E9A6F] border-b-2 border-[#4E9A6F] bg-[#EDF4EF]/30'
                  : 'text-[#7A7570] hover:text-[#1C1C1C]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                tab === 'register'
                  ? 'text-[#4E9A6F] border-b-2 border-[#4E9A6F] bg-[#EDF4EF]/30'
                  : 'text-[#7A7570] hover:text-[#1C1C1C]'
              }`}
            >
              Register
            </button>
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-[#E8E3DA] hover:border-[#4E9A6F] rounded-xl py-3 text-sm font-semibold text-[#1C1C1C] bg-white hover:bg-[#EDF4EF]/30 transition-all disabled:opacity-60 mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Connecting…' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#E8E3DA]" />
              <span className="text-xs font-medium text-[#7A7570] uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-[#E8E3DA]" />
            </div>

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Email address</label>
                  <input
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent bg-[#F7F5F0]/30"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      value={loginForm.password}
                      onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent bg-[#F7F5F0]/30"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-2.5 text-[#7A7570] hover:text-[#1C1C1C]"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#4E9A6F] hover:bg-[#4E9A6F]/90 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60 transition-all shadow-sm mt-4"
                >
                  {loading ? 'Signing in…' : 'Access Patient Portal'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regForm.name}
                    onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent bg-[#F7F5F0]/30"
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Email address</label>
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent bg-[#F7F5F0]/30"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Age</label>
                    <input
                      type="number"
                      value={regForm.age}
                      onChange={e => setRegForm(f => ({ ...f, age: e.target.value }))}
                      className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] bg-[#F7F5F0]/30"
                      placeholder="Age"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Gender</label>
                    <select
                      value={regForm.gender}
                      onChange={e => setRegForm(f => ({ ...f, gender: e.target.value }))}
                      className="w-full border border-[#E8E3DA] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] bg-white"
                    >
                      <option value="">—</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={regForm.phone}
                    onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] bg-[#F7F5F0]/30"
                    placeholder="+91..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regForm.password}
                    onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] bg-[#F7F5F0]/30"
                    placeholder="Min 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={regForm.confirmPassword}
                    onChange={e => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] bg-[#F7F5F0]/30"
                    placeholder="Repeat password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#4E9A6F] hover:bg-[#4E9A6F]/90 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60 transition-all mt-2"
                >
                  {loading ? 'Creating account…' : 'Join AyurSutra'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-[#7A7570] text-xs font-medium uppercase tracking-[0.15em]">
            AyurSutra · Ayurvedic Platform
          </p>
        </div>
      </div>
    </div>
  );
}
