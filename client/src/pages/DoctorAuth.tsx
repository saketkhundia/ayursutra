import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Stethoscope, Eye, EyeOff, Leaf, ArrowLeft, ShieldCheck } from 'lucide-react';
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
    'General Medicine',
    'Cardiology',
    'Dermatology',
    'Neurology',
    'Orthopedics',
    'Pediatrics',
    'Psychiatry',
    'Gynecology & Obstetrics',
    'Ophthalmology',
    'ENT',
    'General Surgery',
    'Oncology',
    'Pulmonology',
    'Endocrinology',
    'Nephrology',
    'Gastroenterology',
  ],
  Homeopathy: [
    'General Homeopathy',
    'Pediatric Homeopathy',
    'Dermatological Homeopathy',
    'Constitutional Prescribing',
    'Clinical Homeopathy',
  ],
  Unani: [
    'General Unani',
    'Moalijat (Medicine)',
    'Jarahiyat (Surgery)',
    'Ilmul Qabalat (Gynecology)',
    'Ilmul Atfal (Pediatrics)',
    'Mahiyatul Amraz (Pathology)',
  ],
  Siddha: [
    'General Siddha',
    'Noi Naadal (Pathology)',
    'Sirappu Maruthuvam (Special Medicine)',
    'Gunapadam (Pharmacology)',
    'Nanju Noolum Maruthuva Neethi Noolum (Toxicology)',
  ],
  Physiotherapy: [
    'Orthopedic Physiotherapy',
    'Neurological Physiotherapy',
    'Sports Physiotherapy',
    'Cardiopulmonary Physiotherapy',
    'Pediatric Physiotherapy',
    'Geriatric Physiotherapy',
  ],
  Dentistry: [
    'General Dentistry',
    'Orthodontics',
    'Periodontics',
    'Endodontics',
    'Prosthodontics',
    'Oral Surgery',
    'Pediatric Dentistry',
  ],
  'Yoga & Naturopathy': [
    'Yoga Therapy',
    'Naturopathy',
    'Diet & Nutrition Therapy',
    'Acupuncture',
    'Hydrotherapy',
  ],
  Other: [
    'General Practice',
    'Other',
  ],
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
    <div className="min-h-screen bg-gradient-to-br from-earth-950 via-earth-900 to-earth-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-earth-300 hover:text-white mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-earth-800 to-earth-900 p-7 text-center">
            <div className="w-14 h-14 rounded-2xl bg-saffron-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Doctor Portal</h2>
            <p className="text-earth-300 text-sm mt-1">ATASS Ayurveda Management System</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-stone-200">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                tab === 'login'
                  ? 'text-saffron-600 border-b-2 border-saffron-500 bg-saffron-50/40'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                tab === 'register'
                  ? 'text-saffron-600 border-b-2 border-saffron-500 bg-saffron-50/40'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Register
            </button>
          </div>

          <div className="p-7">
            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={loginForm.email}
                    onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                    placeholder="doctor@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                    >
                      {showPw ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-saffron-500 hover:bg-saffron-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 transition-colors mt-2"
                >
                  {loading ? 'Signing in…' : 'Sign In to Doctor Portal'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regForm.name}
                    onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                    placeholder="Dr. Full Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                    placeholder="doctor@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Doctor Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={regForm.doctor_type}
                    onChange={e => setRegForm(f => ({ ...f, doctor_type: e.target.value, specialization: '' }))}
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent bg-white"
                  >
                    {DOCTOR_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Specialization <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={regForm.specialization}
                    onChange={e => setRegForm(f => ({ ...f, specialization: e.target.value }))}
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent bg-white"
                  >
                    <option value="">Select your specialization…</option>
                    {(SPECIALIZATIONS_BY_TYPE[regForm.doctor_type] || []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">License No.</label>
                    <input
                      type="text"
                      value={regForm.license_number}
                      onChange={e => setRegForm(f => ({ ...f, license_number: e.target.value }))}
                      className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                      placeholder="e.g. MCI-2020-XXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Experience (yrs)</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={regForm.experience_years}
                      onChange={e => setRegForm(f => ({ ...f, experience_years: e.target.value }))}
                      className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={regForm.password}
                      onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                      placeholder="Minimum 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Confirm Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={regForm.confirmPassword}
                    onChange={e => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                    placeholder="Repeat password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-saffron-500 hover:bg-saffron-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 transition-colors mt-1"
                >
                  {loading ? 'Creating account…' : 'Create Doctor Account'}
                </button>
                <div className="flex items-start gap-2 bg-saffron-50 rounded-xl p-3 mt-1">
                  <ShieldCheck className="w-4 h-4 text-saffron-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-stone-500">
                    Your account will appear in the patient directory immediately. Verified status is granted after license review by admin.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer branding */}
        <div className="text-center mt-6 flex items-center justify-center gap-2 text-earth-500 text-sm">
          <Leaf className="w-4 h-4 text-saffron-500" />
          ATASS · Ayurveda Wellness Platform
        </div>
      </div>
    </div>
  );
}
