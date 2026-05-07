import { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, User, X, Zap, RefreshCw, Brain, Sparkles, CheckCircle, Stethoscope, Trash2, CheckSquare, ShieldCheck, LogIn, LogOut, Lock } from 'lucide-react';
import { api, doctorAuth } from '../api';

function DoctorAvailabilityRow({ practitioner }: { practitioner: any }) {
  const [slots, setSlots] = useState<any[]>([]);
  useEffect(() => {
    api.getAvailability(practitioner.id).then(setSlots).catch(() => {});
  }, [practitioner.id]);
  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50">
      <td className="py-2.5 px-3 min-w-[140px]">
        <div className="font-medium text-stone-800 text-sm flex items-center gap-1">
          {practitioner.name}
          {practitioner.verified && <ShieldCheck className="w-3.5 h-3.5 text-herb-600 flex-shrink-0" />}
        </div>
        <div className="text-xs text-stone-400">{practitioner.specialization}</div>
        {practitioner.doctor_type && practitioner.doctor_type !== 'Ayurveda' && (
          <div className="text-[10px] text-stone-400 bg-stone-100 rounded px-1 py-0.5 inline-block mt-0.5">{practitioner.doctor_type}</div>
        )}
        {practitioner.license_number && <div className="text-[10px] text-stone-300 font-mono mt-0.5">{practitioner.license_number}</div>}
      </td>
      {[0,1,2,3,4,5,6].map(day => {
        const daySlots = slots.filter(s => s.day_of_week === day);
        return (
          <td key={day} className="py-2 px-1 text-center min-w-[70px]">
            {daySlots.length === 0 ? (
              <span className="text-stone-200 text-xs">—</span>
            ) : (
              <div className="space-y-0.5">
                {daySlots.map((s, i) => (
                  <div key={i} className="text-[10px] bg-herb-50 text-herb-700 rounded px-1 py-0.5 whitespace-nowrap">
                    {s.start_time}–{s.end_time}
                  </div>
                ))}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export default function Scheduling() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'availability'>('sessions');
  const [sessions, setSessions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [therapyTypes, setTherapyTypes] = useState<any[]>([]);
  const [treatmentPlans, setTreatmentPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAutoForm, setShowAutoForm] = useState(false);
  const [showAiSchedule, setShowAiSchedule] = useState(false);
  const [aiSlots, setAiSlots] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ scheduled_date: '', scheduled_time: '' });

  // Availability state
  const [availabilitySlots, setAvailabilitySlots] = useState<any[]>([]);
  const [availPractitioner, setAvailPractitioner] = useState('');
  const [availLoading, setAvailLoading] = useState(false);
  const [showAvailForm, setShowAvailForm] = useState(false);
  const [availForm, setAvailForm] = useState({ day_of_week: '1', start_time: '09:00', end_time: '17:00' });
  const [availSaving, setAvailSaving] = useState(false);

  // Doctor login state
  const [loggedInDoctor, setLoggedInDoctor] = useState<any>(() => doctorAuth.getDoctor());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // When booking — show available slots hint
  const [slotHint, setSlotHint] = useState<string[]>([]);
  const [slotHintLoading, setSlotHintLoading] = useState(false);

  const [form, setForm] = useState({
    treatment_plan_id: '', therapy_type_id: '', patient_id: '', practitioner_id: '',
    scheduled_date: '', scheduled_time: '', duration_minutes: ''
  });

  const [autoForm, setAutoForm] = useState({
    treatment_plan_id: '', therapy_type_id: '', patient_id: '', practitioner_id: '',
    start_date: '', num_sessions: '5', frequency_days: '3', preferred_time: '09:00'
  });

  const [aiForm, setAiForm] = useState({
    patient_id: '', therapy_type_id: '', practitioner_id: '', preferred_date: '', num_slots: '5'
  });

  // AI Modal data loading states
  const [aiModalLoading, setAiModalLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filterDate) params.date = filterDate;
    if (filterStatus) params.status = filterStatus;

    Promise.all([
      api.getSessions(Object.keys(params).length ? params : undefined),
      api.getPatients(),
      api.getPractitioners(),
      api.getTherapyTypes(),
      api.getTreatmentPlans(),
    ]).then(([s, p, pr, tt, tp]) => {
      setSessions(s);
      setPatients(p);
      setPractitioners(pr);
      setTherapyTypes(tt);
      setTreatmentPlans(tp);
    }).catch(err => {
      console.error('Error loading data:', err);
      alert('Failed to load data');
    }).finally(() => setLoading(false));
  };

  // Load data on component mount and when filters change
  useEffect(() => { loadData(); }, [filterDate, filterStatus]);
  
  // Refresh patient/therapy/practitioner data frequently so AI Smart Schedule always has current data
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([
        api.getPatients(),
        api.getPractitioners(),
        api.getTherapyTypes(),
      ]).then(([p, pr, tt]) => {
        setPatients(p);
        setPractitioners(pr);
        setTherapyTypes(tt);
      }).catch(err => console.error('Error refreshing data:', err));
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSession({
        ...form,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : undefined
      });
      setShowForm(false);
      setForm({ treatment_plan_id: '', therapy_type_id: '', patient_id: '', practitioner_id: '', scheduled_date: '', scheduled_time: '', duration_minutes: '' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAutoSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.autoSchedule({
        ...autoForm,
        num_sessions: parseInt(autoForm.num_sessions),
        frequency_days: parseInt(autoForm.frequency_days),
      });
      alert(`${result.sessions.length} sessions scheduled successfully!`);
      setShowAutoForm(false);
      setAutoForm({ treatment_plan_id: '', therapy_type_id: '', patient_id: '', practitioner_id: '', start_date: '', num_sessions: '5', frequency_days: '3', preferred_time: '09:00' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (sessionId: string, status: string) => {
    await api.updateSessionStatus(sessionId, { status });
    loadData();
  };

  const handleStartTherapy = async (sessionId: string) => {
    try {
      await api.startTherapySession(sessionId);
      alert('Therapy session started successfully!');
      loadData();
    } catch (err: any) {
      alert('Error starting therapy: ' + (err.message || 'Unknown error'));
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleId) return;
    await api.rescheduleSession(rescheduleId, rescheduleData);
    setRescheduleId(null);
    loadData();
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const loadAvailability = async (practId: string) => {
    if (!practId) { setAvailabilitySlots([]); return; }
    setAvailLoading(true);
    try {
      const slots = await api.getAvailability(practId);
      setAvailabilitySlots(slots);
    } finally {
      setAvailLoading(false);
    }
  };

  const handleAvailPractitionerChange = (id: string) => {
    setAvailPractitioner(id);
    loadAvailability(id);
  };

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!availPractitioner) return;
    setAvailSaving(true);
    try {
      await api.addAvailability({ practitioner_id: availPractitioner, ...availForm, day_of_week: parseInt(availForm.day_of_week) });
      setShowAvailForm(false);
      setAvailForm({ day_of_week: '1', start_time: '09:00', end_time: '17:00' });
      loadAvailability(availPractitioner);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAvailSaving(false);
    }
  };

  const handleDeleteAvailability = async (id: string) => {
    await api.deleteAvailability(id);
    loadAvailability(availPractitioner);
  };

  const handleDoctorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await api.doctorLogin(loginForm.email, loginForm.password);
      doctorAuth.save(res.accessToken, res.doctor, res.refreshToken);
      setLoggedInDoctor(res.doctor);
      setShowLoginModal(false);
      setLoginForm({ email: '', password: '' });
      // Auto-select their own practitioner slot
      setAvailPractitioner(res.doctor.id);
      loadAvailability(res.doctor.id);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleDoctorLogout = () => {
    doctorAuth.clear();
    setLoggedInDoctor(null);
  };

  // Fetch available slots hint when user picks practitioner + date in booking form
  const fetchSlotHint = async (practId: string, date: string) => {
    if (!practId || !date) { setSlotHint([]); return; }
    setSlotHintLoading(true);
    try {
      const result = await api.checkAvailability(practId, date);
      setSlotHint(result.slots || []);
    } catch {
      setSlotHint([]);
    } finally {
      setSlotHintLoading(false);
    }
  };

  const handleAiSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiLoading(true);
    try {
      const result = await api.aiSuggestSlots({
        patient_id: aiForm.patient_id,
        therapy_type_id: aiForm.therapy_type_id,
        practitioner_id: aiForm.practitioner_id,
        start_date: aiForm.preferred_date,
        num_days: Math.min(parseInt(aiForm.num_slots) * 2, 14), // Convert num_slots to num_days (2 days per slot)
      });
      setAiSlots(result.slots || result.suggestions || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const openAiScheduleModal = async () => {
    // Show loading immediately
    setAiModalLoading(true);
    setShowAiSchedule(true);
    
    try {
      // Refresh data before opening modal to ensure fresh patient/therapy/practitioner lists
      const [p, pr, tt, tp] = await Promise.all([
        api.getPatients().catch(err => {
          console.error('Error fetching patients:', err);
          return patients;
        }),
        api.getPractitioners().catch(err => {
          console.error('Error fetching practitioners:', err);
          return practitioners;
        }),
        api.getTherapyTypes().catch(err => {
          console.error('Error fetching therapy types:', err);
          return therapyTypes;
        }),
        api.getTreatmentPlans().catch(err => {
          console.error('Error fetching treatment plans:', err);
          return treatmentPlans;
        }),
      ]);
      
      // Update all states with fresh data
      if (p && p.length > 0) setPatients(p);
      if (pr && pr.length > 0) setPractitioners(pr);
      if (tt && tt.length > 0) setTherapyTypes(tt);
      if (tp && tp.length > 0) setTreatmentPlans(tp);
    } catch (error) {
      console.error('Error refreshing modal data:', error);
    } finally {
      setAiModalLoading(false);
    }
  };

  const handleBookAiSlot = async (slot: any) => {
    // Find or suggest a treatment plan
    let plan = treatmentPlans.find(p => p.patient_id === aiForm.patient_id);
    
    if (!plan) {
      // If no plan found, try to use one with the selected practitioner
      const prPlan = treatmentPlans.find(p => 
        p.patient_id === aiForm.patient_id && 
        (aiForm.practitioner_id === '' || p.practitioner_id === aiForm.practitioner_id)
      );
      
      if (prPlan) {
        plan = prPlan;
      } else {
        // Fallback: check if there's ANY plan for this patient
        const anyPlan = treatmentPlans.find(p => p.patient_id === aiForm.patient_id);
        if (anyPlan) {
          plan = anyPlan;
        } else {
          alert('Please create a treatment plan for this patient first');
          return;
        }
      }
    }
    
    try {
      await api.createSession({
        treatment_plan_id: plan.id,
        therapy_type_id: aiForm.therapy_type_id,
        patient_id: aiForm.patient_id,
        practitioner_id: aiForm.practitioner_id || plan.practitioner_id,
        scheduled_date: slot.date,
        scheduled_time: slot.time,
      });
      setAiSlots(prev => prev.filter(s => s !== slot));
      loadData();
      alert('✅ Session booked successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-amber-100 text-amber-800',
    completed: 'bg-herb-100 text-herb-800',
    cancelled: 'bg-red-100 text-red-800',
    'no-show': 'bg-stone-100 text-stone-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Therapy Scheduling</h1>
          <p className="text-stone-500 mt-1">Schedule and manage therapy sessions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAiScheduleModal} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">
            <Brain className="w-4 h-4" /> AI Smart Schedule
          </button>
          <button onClick={() => setShowAutoForm(true)} className="inline-flex items-center gap-2 bg-herb-600 text-white px-4 py-2.5 rounded-lg hover:bg-herb-700 transition-colors font-medium text-sm">
            <Zap className="w-4 h-4" /> Auto-Schedule
          </button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-saffron-500 text-white px-4 py-2.5 rounded-lg hover:bg-saffron-600 transition-colors font-medium text-sm">
            <Plus className="w-4 h-4" /> New Session
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === 'sessions' ? 'border-saffron-500 text-saffron-700 bg-saffron-50/50' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          <Calendar className="w-4 h-4 inline mr-1.5 -mt-0.5" />Sessions
        </button>
        <button
          onClick={() => setActiveTab('availability')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === 'availability' ? 'border-saffron-500 text-saffron-700 bg-saffron-50/50' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          <Stethoscope className="w-4 h-4 inline mr-1.5 -mt-0.5" />Doctor Availability
        </button>
      </div>

      {/* ── SESSIONS TAB ── */}
      {activeTab === 'sessions' && <>
      <div className="flex flex-wrap gap-3">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500/40 text-sm" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500/40 text-sm">
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {(filterDate || filterStatus) && (
          <button onClick={() => { setFilterDate(''); setFilterStatus(''); }} className="px-3 py-2 text-sm text-stone-500 hover:text-stone-700">Clear filters</button>
        )}
      </div>

      {/* Sessions Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Patient</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Therapy</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Practitioner</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Duration</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="py-3 px-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-stone-400" />{s.scheduled_date}</td>
                    <td className="py-3 px-4 flex items-center gap-2"><Clock className="w-4 h-4 text-stone-400" />{s.scheduled_time}</td>
                    <td className="py-3 px-4 font-medium flex items-center gap-2"><User className="w-4 h-4 text-stone-400" />{s.patient_name}</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-saffron-100 text-saffron-800">{s.therapy_name}</span></td>
                    <td className="py-3 px-4">{s.practitioner_name}</td>
                    <td className="py-3 px-4">{s.duration_minutes} min</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] || 'bg-stone-100 text-stone-600'}`}>{s.status}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {s.status === 'scheduled' && (
                          <>
                            <button onClick={() => handleStartTherapy(s.id)} className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 font-medium">Start Therapy</button>
                            <button onClick={() => { setRescheduleId(s.id); setRescheduleData({ scheduled_date: s.scheduled_date, scheduled_time: s.scheduled_time }); }} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"><RefreshCw className="w-3 h-3" /></button>
                            <button onClick={() => handleStatusChange(s.id, 'cancelled')} className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100">Cancel</button>
                          </>
                        )}
                        {s.status === 'in-progress' && (
                          <button onClick={() => handleStatusChange(s.id, 'completed')} className="text-xs px-2 py-1 bg-herb-50 text-herb-700 rounded hover:bg-herb-100">Complete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-stone-400">No sessions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>}

      {/* ── DOCTOR AVAILABILITY TAB ── */}
      {activeTab === 'availability' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Doctor Availability</h2>
                <p className="text-sm text-stone-500 mt-0.5">Doctors log in to set their weekly working hours</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {loggedInDoctor ? (
                  <>
                    <div className="flex items-center gap-2 bg-herb-50 border border-herb-200 rounded-lg px-3 py-1.5">
                      {loggedInDoctor.verified && <ShieldCheck className="w-4 h-4 text-herb-600" />}
                      <span className="text-sm font-medium text-herb-800">{loggedInDoctor.name}</span>
                    </div>
                    <button onClick={handleDoctorLogout} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 rounded-lg text-sm text-stone-500 hover:bg-stone-50">
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                    <button
                      onClick={() => setShowAvailForm(true)}
                      disabled={availPractitioner !== loggedInDoctor.id}
                      className="inline-flex items-center gap-2 bg-saffron-500 text-white px-4 py-2 rounded-lg hover:bg-saffron-600 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" /> Add Time Slot
                    </button>
                  </>
                ) : (
                  <button onClick={() => setShowLoginModal(true)} className="inline-flex items-center gap-2 bg-herb-600 text-white px-4 py-2 rounded-lg hover:bg-herb-700 font-medium text-sm">
                    <LogIn className="w-4 h-4" /> Doctor Login
                  </button>
                )}
              </div>
            </div>

            {/* Practitioner selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-1">Select Doctor / Practitioner</label>
              <select
                value={availPractitioner}
                onChange={e => handleAvailPractitionerChange(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40 text-sm"
              >
                <option value="">-- Choose a practitioner --</option>
                {practitioners.map(pr => (
                  <option key={pr.id} value={pr.id}>{pr.name} — {pr.specialization}</option>
                ))}
              </select>
            </div>

            {/* Availability grid */}
            {!availPractitioner ? (
              <div className="text-center py-16 text-stone-400">
                <Stethoscope className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a practitioner to view or set their availability</p>
              </div>
            ) : availLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                {[0,1,2,3,4,5,6].map(day => {
                  const daySlots = availabilitySlots.filter(s => s.day_of_week === day);
                  const isWeekend = day === 0 || day === 6;
                  return (
                    <div key={day} className={`rounded-lg border p-3 ${isWeekend ? 'border-stone-100 bg-stone-50/50' : 'border-stone-200 bg-white'}`}>
                      <p className={`text-xs font-semibold mb-2 ${isWeekend ? 'text-stone-400' : 'text-stone-700'}`}>
                        {DAYS[day].substring(0,3).toUpperCase()}
                      </p>
                      <div className="space-y-1.5">
                        {daySlots.length === 0 ? (
                          <p className="text-[11px] text-stone-300 italic">Not available</p>
                        ) : (
                          daySlots.map(slot => (
                            <div key={slot.id} className="flex items-center justify-between gap-1 bg-herb-50 border border-herb-100 rounded px-1.5 py-1">
                              <span className="text-[11px] font-medium text-herb-800">{slot.start_time}–{slot.end_time}</span>
                              {loggedInDoctor?.id === availPractitioner && (
                                <button
                                  onClick={() => handleDeleteAvailability(slot.id)}
                                  className="text-red-400 hover:text-red-600 flex-shrink-0"
                                  title="Remove slot"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All-doctors overview: read-only grid for patients */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-base font-semibold text-stone-900 mb-1">All Doctors — Weekly Availability Overview</h2>
            <p className="text-sm text-stone-500 mb-5">Patients can view when each doctor is available before booking</p>
            {practitioners.length === 0 ? (
              <p className="text-sm text-stone-400">No practitioners found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left py-2 px-3 font-medium text-stone-500 w-44">Doctor</th>
                      {DAYS.map((_d, i) => (
                        <th key={i} className="text-center py-2 px-1 font-medium text-stone-500 text-xs">{DAY_SHORT[i]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {practitioners.map(pr => (
                      <DoctorAvailabilityRow key={pr.id} practitioner={pr} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Doctor Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold flex items-center gap-2"><Lock className="w-5 h-5 text-herb-600" /> Doctor Login</h2>
              <button onClick={() => setShowLoginModal(false)} className="p-1 rounded-lg hover:bg-stone-100"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-stone-500 mb-4">Only verified practitioners can manage their availability slots.</p>
            <form onSubmit={handleDoctorLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input required type="email" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="dr.email@atass.com"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-herb-500/40 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
                <input required type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-herb-500/40 text-sm" />
              </div>
              {loginError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loginError}</p>}
              <div className="bg-stone-50 rounded-lg p-3 text-xs text-stone-500 space-y-0.5">
                <p className="font-medium text-stone-600 mb-1">Demo credentials:</p>
                <p>dr.arun@atass.com / doctor123</p>
                <p>dr.priya@atass.com / doctor123</p>
                <p>dr.rajesh@atass.com / doctor123</p>
              </div>
              <button type="submit" disabled={loginLoading}
                className="w-full px-4 py-2.5 bg-herb-600 text-white rounded-lg hover:bg-herb-700 font-medium text-sm disabled:opacity-50">
                {loginLoading ? 'Signing in…' : 'Sign In as Doctor'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Availability Modal */}
      {showAvailForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAvailForm(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Availability Slot</h2>
              <button onClick={() => setShowAvailForm(false)} className="p-1 rounded-lg hover:bg-stone-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddAvailability} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Day of Week *</label>
                <select required value={availForm.day_of_week} onChange={e => setAvailForm({ ...availForm, day_of_week: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40">
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                  <input required type="time" value={availForm.start_time} onChange={e => setAvailForm({ ...availForm, start_time: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                  <input required type="time" value={availForm.end_time} onChange={e => setAvailForm({ ...availForm, end_time: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAvailForm(false)} className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg hover:bg-stone-50 font-medium text-sm">Cancel</button>
                <button type="submit" disabled={availSaving} className="flex-1 px-4 py-2.5 bg-saffron-500 text-white rounded-lg hover:bg-saffron-600 font-medium text-sm disabled:opacity-50">
                  {availSaving ? 'Saving...' : 'Save Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setSlotHint([]); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Schedule New Session</h2>
              <button onClick={() => { setShowForm(false); setSlotHint([]); }} className="p-1 rounded-lg hover:bg-stone-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Treatment Plan *</label>
                <select required value={form.treatment_plan_id} onChange={e => {
                  const plan = treatmentPlans.find((p: any) => p.id === e.target.value);
                  const newPractId = plan?.practitioner_id || '';
                  setForm({ ...form, treatment_plan_id: e.target.value, patient_id: plan?.patient_id || '', practitioner_id: newPractId });
                  if (newPractId && form.scheduled_date) fetchSlotHint(newPractId, form.scheduled_date);
                }} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40">
                  <option value="">Select plan...</option>
                  {treatmentPlans.map(p => <option key={p.id} value={p.id}>{p.plan_name} - {p.patient_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Therapy Type *</label>
                <select required value={form.therapy_type_id} onChange={e => setForm({ ...form, therapy_type_id: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40">
                  <option value="">Select therapy...</option>
                  {therapyTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category}) - {t.duration_minutes} min</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
                  <input required type="date" value={form.scheduled_date} onChange={e => {
                    setForm({ ...form, scheduled_date: e.target.value });
                    if (form.practitioner_id && e.target.value) fetchSlotHint(form.practitioner_id, e.target.value);
                  }} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Time *</label>
                  <input required type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
              </div>
              {/* Available slots hint */}
              {form.practitioner_id && form.scheduled_date && (
                <div className={`rounded-lg px-3 py-2.5 text-xs ${slotHint.length > 0 ? 'bg-herb-50 border border-herb-200' : 'bg-stone-50 border border-stone-200'}`}>
                  {slotHintLoading ? (
                    <span className="text-stone-400">Checking availability...</span>
                  ) : slotHint.length > 0 ? (
                    <div>
                      <p className="font-medium text-herb-700 mb-1.5 flex items-center gap-1"><CheckSquare className="w-3.5 h-3.5" /> Doctor available — {slotHint.length} open slot{slotHint.length > 1 ? 's' : ''}</p>
                      <div className="flex flex-wrap gap-1">
                        {slotHint.slice(0, 12).map(t => (
                          <button key={t} type="button" onClick={() => setForm(f => ({ ...f, scheduled_time: t }))}
                            className={`px-2 py-0.5 rounded font-mono ${form.scheduled_time === t ? 'bg-herb-600 text-white' : 'bg-herb-100 text-herb-800 hover:bg-herb-200'}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-stone-400">No availability set for this day — you can still schedule manually</span>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setSlotHint([]); }} className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg hover:bg-stone-50 font-medium text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-saffron-500 text-white rounded-lg hover:bg-saffron-600 font-medium text-sm">Schedule Session</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-Schedule Modal */}
      {showAutoForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAutoForm(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-herb-600" />Auto-Schedule Sessions</h2>
              <button onClick={() => setShowAutoForm(false)} className="p-1 rounded-lg hover:bg-stone-100"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-stone-500 mb-4">Automatically schedule multiple therapy sessions with customizable frequency. Notifications will be created for each session.</p>
            <form onSubmit={handleAutoSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Treatment Plan *</label>
                <select required value={autoForm.treatment_plan_id} onChange={e => {
                  const plan = treatmentPlans.find((p: any) => p.id === e.target.value);
                  setAutoForm({ ...autoForm, treatment_plan_id: e.target.value, patient_id: plan?.patient_id || '', practitioner_id: plan?.practitioner_id || '' });
                }} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40">
                  <option value="">Select plan...</option>
                  {treatmentPlans.map(p => <option key={p.id} value={p.id}>{p.plan_name} - {p.patient_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Therapy Type *</label>
                <select required value={autoForm.therapy_type_id} onChange={e => setAutoForm({ ...autoForm, therapy_type_id: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40">
                  <option value="">Select therapy...</option>
                  {therapyTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Start Date *</label>
                  <input required type="date" value={autoForm.start_date} onChange={e => setAutoForm({ ...autoForm, start_date: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Preferred Time *</label>
                  <input required type="time" value={autoForm.preferred_time} onChange={e => setAutoForm({ ...autoForm, preferred_time: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Number of Sessions *</label>
                  <input required type="number" min="1" max="30" value={autoForm.num_sessions} onChange={e => setAutoForm({ ...autoForm, num_sessions: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Frequency (days) *</label>
                  <input required type="number" min="1" max="30" value={autoForm.frequency_days} onChange={e => setAutoForm({ ...autoForm, frequency_days: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAutoForm(false)} className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg hover:bg-stone-50 font-medium text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-herb-600 text-white rounded-lg hover:bg-herb-700 font-medium text-sm">Auto-Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Smart Schedule Modal */}
      {showAiSchedule && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowAiSchedule(false); setAiSlots([]); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Brain className="w-5 h-5 text-indigo-600" />AI Smart Schedule</h2>
              <button onClick={() => { setShowAiSchedule(false); setAiSlots([]); }} className="p-1 rounded-lg hover:bg-stone-100"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-stone-500 mb-4">AI analyzes patient dosha, therapy history, and practitioner availability to suggest optimal time slots.</p>
            <form onSubmit={handleAiSuggest} className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Patient *</label>
                  <select required value={aiForm.patient_id} onChange={e => setAiForm({ ...aiForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm">
                    <option value="">
                      {aiModalLoading ? 'Loading patients...' : patients.length === 0 ? 'No patients available' : 'Select patient...'}
                    </option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name} {p.dosha_type ? `(${p.dosha_type})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Therapy *</label>
                  <select required value={aiForm.therapy_type_id} onChange={e => setAiForm({ ...aiForm, therapy_type_id: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm">
                    <option value="">
                      {aiModalLoading ? 'Loading therapies...' : therapyTypes.length === 0 ? 'No therapies available' : 'Select therapy...'}
                    </option>
                    {therapyTypes.map(t => <option key={t.id} value={t.id}>{t.name} {t.category ? `(${t.category})` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Practitioner</label>
                  <select value={aiForm.practitioner_id} onChange={e => setAiForm({ ...aiForm, practitioner_id: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm">
                    <option value="">
                      {aiModalLoading ? 'Loading practitioners...' : practitioners.length === 0 ? 'Any' : 'Any'}
                    </option>
                    {practitioners.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Preferred Date</label>
                  <input type="date" value={aiForm.preferred_date} onChange={e => setAiForm({ ...aiForm, preferred_date: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Slots</label>
                  <input type="number" min="1" max="10" value={aiForm.num_slots} onChange={e => setAiForm({ ...aiForm, num_slots: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm" />
                </div>
              </div>
              <button type="submit" disabled={aiLoading} className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {aiLoading ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Analyzing...</> : <><Sparkles className="w-4 h-4" /> Get AI Suggestions</>}
              </button>
            </form>

            {aiSlots.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-stone-700 mb-3">Suggested Time Slots</h3>
                <div className="space-y-3">
                  {aiSlots.map((slot: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{slot.date} at {slot.time}</span>
                          <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            Score: {slot.score || slot.confidence || 'N/A'}
                          </span>
                        </div>
                        {slot.reasons && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {slot.reasons.map((r: string, j: number) => (
                              <span key={j} className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">{r}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleBookAiSlot(slot)} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-herb-600 text-white rounded-lg hover:bg-herb-700 font-medium">
                        <CheckCircle className="w-3 h-3" /> Book
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRescheduleId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Reschedule Session</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">New Date</label>
                <input type="date" value={rescheduleData.scheduled_date} onChange={e => setRescheduleData({ ...rescheduleData, scheduled_date: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">New Time</label>
                <input type="time" value={rescheduleData.scheduled_time} onChange={e => setRescheduleData({ ...rescheduleData, scheduled_time: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRescheduleId(null)} className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg hover:bg-stone-50 font-medium text-sm">Cancel</button>
                <button onClick={handleReschedule} className="flex-1 px-4 py-2.5 bg-saffron-500 text-white rounded-lg hover:bg-saffron-600 font-medium text-sm">Reschedule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
