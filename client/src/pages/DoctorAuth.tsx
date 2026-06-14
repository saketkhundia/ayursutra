import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Stethoscope, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import { api, userAuth } from '../api';

const DOCTOR_TYPES = [
  'Ayurveda',
  'Allopathy',
  'Homeopathy',
  'Unani',
  'Siddha',
  'Physiotherapy',
  'Dentistry',
  'Yoga & Naturopathy',
  'Other',
] as const;

const SPECIALIZATIONS_BY_TYPE: Record<string, string[]> = {
  Ayurveda: [
    'General Ayurveda',
    'Panchakarma Therapy',
    'Kayachikitsa (Internal Medicine)',
    'Shalya Tantra (Surgery)',
    'Shalakya Tantra (ENT & Ophthalmology)',
    'Prasuti & Stri Roga (Gynecology)',
    'Kaumarabhritya (Pediatrics)',
    'Rasayana Chikitsa (Rejuvenation)',
    'Manas Roga (Psychiatry)',
  ],
  Allopathy: [
    'General Medicine', 'Cardiology', 'Dermatology', 'Neurology', 'Orthopedics',
    'Pediatrics', 'Psychiatry', 'Gynecology & Obstetrics', 'Ophthalmology',
    'ENT', 'General Surgery', 'Oncology', 'Pulmonology', 'Endocrinology',
    'Nephrology', 'Gastroenterology'
  ],
  Homeopathy: ['General Homeopathy', 'Pediatric Homeopathy', 'Dermatological Homeopathy'],
  Unani: ['General Unani', 'Moalijat (Medicine)', 'Jarahiyat (Surgery)'],
  Siddha: ['General Siddha', 'Noi Naadal (Pathology)'],
  Physiotherapy: ['Orthopedic Physiotherapy', 'Neurological Physiotherapy', 'Sports Physiotherapy'],
  Dentistry: ['General Dentistry', 'Orthodontics', 'Oral Surgery'],
  'Yoga & Naturopathy': ['Yoga Therapy', 'Naturopathy', 'Diet & Nutrition Therapy'],
  Other: ['General Practice', 'Other'],
};

export default function DoctorAuth() {
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
    doctor_type: 'Ayurveda',
    specialization: '',
    license_number: '',
    experience_years: '',
  });

  useEffect(() => {
    if (userAuth.isLoggedIn() && userAuth.getRole() === 'doctor') {
      navigate('/dashboard', { replace: true });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.doctorLogin(loginForm.email, loginForm.password);
      userAuth.save(res.accessToken, res.doctor, 'doctor', res.refreshToken);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message);
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
    if (!regForm.specialization) {
      setError('Please select your specialization');
      return;
    }
    setLoading(true);
    try {
      const res = await api.registerDoctor({
        name: regForm.name,
        email: regForm.email,
        password: regForm.password,
        doctor_type: regForm.doctor_type,
        specialization: regForm.specialization,
        license_number: regForm.license_number,
        experience_years: regForm.experience_years ? Number(regForm.experience_years) : 0,
      });
      userAuth.save(res.accessToken, res.doctor, 'doctor', res.refreshToken);
      navigate('/dashboard', { replace: true });
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
              <Stethoscope className="w-6 h-6 text-[#4E9A6F]" />
            </div>
            <h2 className="text-2xl font-bold text-[#1C1C1C]">Practitioner Portal</h2>
            <p className="text-[#7A7570] text-sm mt-1">Access your AyurSutra practice</p>
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
                    placeholder="doctor@example.com"
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
                  {loading ? 'Authenticating…' : 'Sign In to Portal'}
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
                    placeholder="Dr. Full Name"
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
                    placeholder="doctor@example.com"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Type</label>
                    <select
                      value={regForm.doctor_type}
                      onChange={e => setRegForm(f => ({ ...f, doctor_type: e.target.value, specialization: '' }))}
                      className="w-full border border-[#E8E3DA] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] bg-white"
                    >
                      {DOCTOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Specialization</label>
                    <select
                      required
                      value={regForm.specialization}
                      onChange={e => setRegForm(f => ({ ...f, specialization: e.target.value }))}
                      className="w-full border border-[#E8E3DA] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] bg-white"
                    >
                      <option value="">Select…</option>
                      {(SPECIALIZATIONS_BY_TYPE[regForm.doctor_type] || []).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">License No.</label>
                    <input
                      type="text"
                      value={regForm.license_number}
                      onChange={e => setRegForm(f => ({ ...f, license_number: e.target.value }))}
                      className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] bg-[#F7F5F0]/30"
                      placeholder="Registration #"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold tracking-wider text-[#7A7570] uppercase mb-2">Exp (yrs)</label>
                    <input
                      type="number"
                      value={regForm.experience_years}
                      onChange={e => setRegForm(f => ({ ...f, experience_years: e.target.value }))}
                      className="w-full border border-[#E8E3DA] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] bg-[#F7F5F0]/30"
                      placeholder="0"
                    />
                  </div>
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
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
                <div className="flex items-start gap-2 bg-[#EDF4EF] rounded-xl p-3 mt-1">
                  <ShieldCheck className="w-4 h-4 text-[#4E9A6F] mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-[#7A7570] leading-normal font-medium uppercase tracking-wider">
                    Verified status is granted after license review by admin.
                  </p>
                </div>
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
