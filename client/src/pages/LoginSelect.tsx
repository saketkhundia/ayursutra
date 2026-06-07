import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, User2, Leaf, ArrowRight } from 'lucide-react';
import { userAuth } from '../api';

export default function LoginSelect() {
  const navigate = useNavigate();

  useEffect(() => {
    if (userAuth.isLoggedIn()) {
      navigate(userAuth.getRole() === 'patient' ? '/find-doctors' : '/dashboard', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-earth-950 via-earth-900 to-earth-800 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-12">
        <div className="w-20 h-20 rounded-2xl bg-saffron-500 flex items-center justify-center mx-auto mb-5 shadow-2xl">
          <Leaf className="w-11 h-11 text-white" />
        </div>
        <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">ATASS</h1>
        <p className="text-earth-300 text-lg">Ayurveda Therapy & Scheduling System</p>
      </div>

      <p className="text-earth-200 text-xl text-center mb-10 max-w-md leading-relaxed">
        Connect with certified Ayurveda practitioners for holistic healing and wellness
      </p>

      {/* Role selection cards */}
      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-xl">
        <button
          type="button"
          onClick={() => navigate('/login/doctor')}
          className="flex-1 group bg-white/10 hover:bg-saffron-500/20 border border-white/20 hover:border-saffron-400 rounded-2xl p-8 text-center transition-all duration-200 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400 focus-visible:ring-offset-4 focus-visible:ring-offset-earth-950 sm:hover:scale-[1.01]"
        >
          <div className="w-16 h-16 rounded-2xl bg-saffron-500/20 group-hover:bg-saffron-500/30 flex items-center justify-center mx-auto mb-5 transition-colors">
            <Stethoscope className="w-9 h-9 text-saffron-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">I'm a Doctor</h2>
          <p className="text-earth-300 text-sm mb-6 leading-relaxed">
            Manage patients, publish your specialization, and schedule Ayurveda treatments
          </p>
          <span className="inline-flex items-center gap-2 text-saffron-400 text-sm font-semibold">
            Login or Register <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/login/patient')}
          className="flex-1 group bg-white/10 hover:bg-emerald-500/20 border border-white/20 hover:border-emerald-400 rounded-2xl p-8 text-center transition-all duration-200 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-4 focus-visible:ring-offset-earth-950 sm:hover:scale-[1.01]"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 group-hover:bg-emerald-500/30 flex items-center justify-center mx-auto mb-5 transition-colors">
            <User2 className="w-9 h-9 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">I'm a Patient</h2>
          <p className="text-earth-300 text-sm mb-6 leading-relaxed">
            Find Ayurveda doctors, explore specializations, and begin your healing journey
          </p>
          <span className="inline-flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            Login or Register <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </div>

      <p className="text-earth-600 text-sm mt-12">© 2026 ATASS · Ayurveda Wellness Platform</p>
    </div>
  );
}
