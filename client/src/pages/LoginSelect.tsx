import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, User2, ArrowRight } from 'lucide-react';
import { userAuth } from '../api';

export default function LoginSelect() {
  const navigate = useNavigate();

  useEffect(() => {
    if (userAuth.isLoggedIn()) {
      navigate(userAuth.getRole() === 'patient' ? '/find-doctors' : '/dashboard', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col items-center justify-center p-6 font-sans">
      {/* Logo */}
      <div className="text-center mb-12">
        <h1 className="text-[40px] font-bold text-[#1C1C1C] mb-2 tracking-tight">
          Ayur<span className="text-[#4E9A6F]">Sutra</span>
        </h1>
        <p className="text-[#7A7570] text-lg">Ayurvedic Health & Therapy Platform</p>
      </div>

      <p className="text-[#5A5550] text-xl text-center mb-12 max-w-md leading-relaxed">
        Connect with certified practitioners for holistic healing and wellness.
      </p>

      {/* Role selection cards */}
      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
        <button
          type="button"
          onClick={() => navigate('/login/doctor')}
          className="flex-1 group bg-white border border-[#E8E3DA] hover:border-[#4E9A6F] rounded-2xl p-8 text-left transition-all duration-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4E9A6F]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#EDF4EF] flex items-center justify-center mb-6">
            <Stethoscope className="w-6 h-6 text-[#4E9A6F]" />
          </div>
          <h2 className="text-2xl font-bold text-[#1C1C1C] mb-3">I'm a Practitioner</h2>
          <p className="text-[#7A7570] text-sm mb-8 leading-relaxed">
            Manage your clinic, consult with patients, and track therapy progress.
          </p>
          <span className="inline-flex items-center gap-2 text-[#4E9A6F] text-sm font-semibold">
            Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/login/patient')}
          className="flex-1 group bg-white border border-[#E8E3DA] hover:border-[#4E9A6F] rounded-2xl p-8 text-left transition-all duration-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4E9A6F]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#EDF4EF] flex items-center justify-center mb-6">
            <User2 className="w-6 h-6 text-[#4E9A6F]" />
          </div>
          <h2 className="text-2xl font-bold text-[#1C1C1C] mb-3">I'm a Patient</h2>
          <p className="text-[#7A7570] text-sm mb-8 leading-relaxed">
            Find expert doctors, book sessions, and follow your treatment plan.
          </p>
          <span className="inline-flex items-center gap-2 text-[#4E9A6F] text-sm font-semibold">
            Join the Portal <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </div>

      <p className="text-[#7A7570] text-xs mt-16 font-medium uppercase tracking-[0.1em]">
        © 2026 AyurSutra · Natural Healing
      </p>
    </div>
  );
}
