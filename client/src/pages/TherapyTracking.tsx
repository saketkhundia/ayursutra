import { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle, Eye, AlertTriangle, Wifi, WifiOff, XCircle, Loader2, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';

export default function TherapyTracking() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { connected, on, joinRoom } = useSocket();

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionSession, setActionSession] = useState<any>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [showCancelPlanModal, setShowCancelPlanModal] = useState(false);
  const [cancelPlanTarget, setCancelPlanTarget] = useState<any>(null);
  const [cancelPlanReason, setCancelPlanReason] = useState('');

  const loadData = () => {
    Promise.all([
      api.getSessions(),
      api.getTreatmentPlans(),
    ]).then(([s, p]) => {
      setSessions(s);
      setPlans(p);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    joinRoom('dashboard');

    const unsubUpdate = on('session:updated', (data: any) => {
      const sid = data?.id ?? data?.session_id;
      setSessions(prev => prev.map(s => (sid && s.id === sid ? { ...s, ...data, status: data.status ?? s.status } : s)));
    });
    const unsubCreate = on('session:created', () => loadData());

    return () => { unsubUpdate(); unsubCreate(); };
  }, []);

  const activeSessions = sessions.filter(s => s.status === 'in-progress');
  const todaySessions = sessions.filter(s => s.scheduled_date === new Date().toISOString().split('T')[0]);
  const completedSessions = sessions.filter(s => s.status === 'completed');

  const handleMarkComplete = async () => {
    if (!actionSession) return;
    setIsProcessing(true);
    try {
      await api.updateSessionStatus(actionSession.id, { status: 'completed', session_notes: actionNotes });
      setSessions(prev => prev.map(s => s.id === actionSession.id ? { ...s, status: 'completed', session_notes: actionNotes, actual_end_time: new Date().toISOString() } : s));
      setShowCompleteModal(false);
      setActionSession(null);
      setActionNotes('');
    } catch (err: any) {
      alert('Failed to mark session completed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSession = async () => {
    if (!actionSession || !cancelReason.trim()) return;
    setIsProcessing(true);
    try {
      await api.updateSessionStatus(actionSession.id, { status: 'cancelled', session_notes: cancelReason });
      setSessions(prev => prev.map(s => s.id === actionSession.id ? { ...s, status: 'cancelled', session_notes: cancelReason } : s));
      setShowCancelModal(false);
      setActionSession(null);
      setCancelReason('');
    } catch (err: any) {
      alert('Failed to cancel session: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelPlan = async () => {
    if (!cancelPlanTarget || !cancelPlanReason.trim()) return;
    setIsProcessing(true);
    try {
      await api.updateTreatmentPlan(cancelPlanTarget.id, { status: 'cancelled', notes: cancelPlanReason });
      setPlans(prev => prev.map(p => p.id === cancelPlanTarget.id ? { ...p, status: 'cancelled', notes: cancelPlanReason } : p));
      setShowCancelPlanModal(false);
      setCancelPlanTarget(null);
      setCancelPlanReason('');
    } catch (err: any) {
      alert('Failed to cancel plan: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Session progress data per plan
  const planProgress = plans.map(plan => {
    const planSessions = sessions.filter(s => s.treatment_plan_id === plan.id);
    const completed = planSessions.filter(s => s.status === 'completed').length;
    const total = planSessions.length;
    return { name: plan.plan_name?.substring(0, 20), completed, total, remaining: total - completed };
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Real-Time Therapy Tracking</h1>
          <p className="text-stone-500 mt-1">Monitor active sessions, therapy progress, and recovery milestones</p>
        </div>
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${connected ? 'bg-herb-100 text-herb-700' : 'bg-stone-100 text-stone-500'}`}>
          {connected ? <><Wifi className="w-3 h-3" /> Live</> : <><WifiOff className="w-3 h-3" /> Offline</>}
        </div>
      </div>

      {/* Live Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeSessions.length}</p>
              <p className="text-sm text-stone-500">In Progress Now</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todaySessions.length}</p>
              <p className="text-sm text-stone-500">Today's Sessions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-herb-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-herb-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedSessions.length}</p>
              <p className="text-sm text-stone-500">Total Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Sessions (Real-Time) */}
      {activeSessions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-saffron-50 rounded-xl border border-amber-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Live Sessions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSessions.map(s => (
              <div key={s.id} className="bg-white rounded-lg p-4 border border-amber-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{s.patient_name}</p>
                    <p className="text-sm text-saffron-700">{s.therapy_name}</p>
                    <p className="text-xs text-stone-500 mt-1">with {s.practitioner_name}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-800 rounded-full animate-pulse">In Progress</span>
                </div>
                <div className="mt-3">
                  <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-xs text-stone-500 mt-1">{s.duration_minutes} min session</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => { setActionSession(s); setActionNotes(''); setShowCompleteModal(true); }}
                    className="flex-1 text-xs flex items-center justify-center gap-1 bg-herb-500 hover:bg-herb-600 text-white font-semibold py-1.5 px-2 rounded-lg transition"
                  >
                    <CheckCircle className="w-3 h-3" /> Done
                  </button>
                  <button
                    onClick={() => { setActionSession(s); setCancelReason(''); setShowCancelModal(true); }}
                    className="flex-1 text-xs flex items-center justify-center gap-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-1.5 px-2 rounded-lg transition"
                  >
                    <XCircle className="w-3 h-3" /> Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan Progress Chart */}
      {planProgress.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4">Treatment Plan Progress</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={planProgress} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="completed" name="Completed" fill="#13a31c" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="remaining" name="Remaining" fill="#ffc170" stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* All Treatment Plans with Progress */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-900 mb-4">Treatment Plans Overview</h3>
        <div className="space-y-4">
          {plans.map(plan => {
            const planSessions = sessions.filter((s: any) => s.treatment_plan_id === plan.id);
            const completed = planSessions.filter((s: any) => s.status === 'completed').length;
            const total = planSessions.length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div key={plan.id} className="p-4 bg-stone-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-stone-900">{plan.plan_name}</h4>
                    <p className="text-sm text-stone-500">{plan.patient_name} &middot; Dr. {plan.practitioner_name}</p>
                    <p className="text-xs text-stone-400 mt-1">{plan.start_date} → {plan.end_date}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    plan.status === 'active' ? 'bg-herb-100 text-herb-800' : plan.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-stone-100 text-stone-600'
                  }`}>{plan.status}</span>
                </div>
                {plan.status === 'active' && (
                  <div className="mt-2">
                    <button
                      onClick={() => { setCancelPlanTarget(plan); setCancelPlanReason(''); setShowCancelPlanModal(true); }}
                      className="text-xs flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2.5 rounded-lg transition"
                    >
                      <XCircle className="w-3 h-3" /> Cancel Plan
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-saffron-500 to-herb-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-stone-700 w-16 text-right">{completed}/{total} ({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session Details */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-900 mb-4">All Sessions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sessions.slice(0, 12).map(s => (
            <div
              key={s.id}
              className="p-4 rounded-lg border border-stone-100 hover:border-saffron-200 cursor-pointer transition-colors"
              onClick={() => setSelectedSession(s.id === selectedSession?.id ? null : s)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{s.therapy_name}</p>
                  <p className="text-xs text-stone-500">{s.patient_name}</p>
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  s.status === 'completed' ? 'bg-herb-100 text-herb-800' :
                  s.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                  s.status === 'in-progress' ? 'bg-amber-100 text-amber-800' :
                  'bg-stone-100 text-stone-600'
                }`}>{s.status}</span>
              </div>
              <p className="text-xs text-stone-400 mt-2">{s.scheduled_date} at {s.scheduled_time}</p>
              {s.progress_score && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-herb-500 rounded-full" style={{ width: `${s.progress_score}%` }} />
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5">Score: {s.progress_score}%</p>
                </div>
              )}
              {s.status === 'in-progress' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionSession(s); setActionNotes(''); setShowCompleteModal(true); }}
                    className="flex-1 text-xs flex items-center justify-center gap-1 bg-herb-500 hover:bg-herb-600 text-white font-semibold py-1.5 px-2 rounded-lg transition"
                  >
                    <CheckCircle className="w-3 h-3" /> Complete
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionSession(s); setCancelReason(''); setShowCancelModal(true); }}
                    className="flex-1 text-xs flex items-center justify-center gap-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-1.5 px-2 rounded-lg transition"
                  >
                    <XCircle className="w-3 h-3" /> Cancel
                  </button>
                </div>
              )}
              {s.status === 'scheduled' && (
                <div className="mt-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionSession(s); setCancelReason(''); setShowCancelModal(true); }}
                    className="w-full text-xs flex items-center justify-center gap-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-1.5 px-2 rounded-lg transition"
                  >
                    <Trash2 className="w-3 h-3" /> Cancel / Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Session detail panel */}
      {selectedSession && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2"><Eye className="w-5 h-5 text-saffron-500" />Session Details</h3>
            <button onClick={() => setSelectedSession(null)} className="text-sm text-stone-500 hover:text-stone-700">Close</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-stone-500">Therapy</p><p className="font-medium">{selectedSession.therapy_name}</p></div>
            <div><p className="text-stone-500">Patient</p><p className="font-medium">{selectedSession.patient_name}</p></div>
            <div><p className="text-stone-500">Practitioner</p><p className="font-medium">{selectedSession.practitioner_name}</p></div>
            <div><p className="text-stone-500">Duration</p><p className="font-medium">{selectedSession.duration_minutes} min</p></div>
            <div><p className="text-stone-500">Date</p><p className="font-medium">{selectedSession.scheduled_date}</p></div>
            <div><p className="text-stone-500">Time</p><p className="font-medium">{selectedSession.scheduled_time}</p></div>
            <div><p className="text-stone-500">Status</p><p className="font-medium">{selectedSession.status}</p></div>
            {selectedSession.progress_score && <div><p className="text-stone-500">Progress</p><p className="font-medium">{selectedSession.progress_score}%</p></div>}
          </div>
          {selectedSession.pre_procedure_instructions && (
            <div className="mt-4 p-3 bg-saffron-50 border border-saffron-200 rounded-lg">
              <p className="text-sm font-medium text-saffron-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Pre-Procedure Instructions</p>
              <p className="text-sm text-saffron-700 mt-1 whitespace-pre-line">{selectedSession.pre_procedure_instructions}</p>
            </div>
          )}
          {selectedSession.post_procedure_instructions && (
            <div className="mt-3 p-3 bg-herb-50 border border-herb-200 rounded-lg">
              <p className="text-sm font-medium text-herb-800 flex items-center gap-2"><CheckCircle className="w-4 h-4" />Post-Procedure Instructions</p>
              <p className="text-sm text-herb-700 mt-1 whitespace-pre-line">{selectedSession.post_procedure_instructions}</p>
            </div>
          )}

          {selectedSession.status === 'in-progress' && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setActionSession(selectedSession); setActionNotes(''); setShowCompleteModal(true); }}
                className="flex-1 flex items-center justify-center gap-2 bg-herb-500 hover:bg-herb-600 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Mark Completed
              </button>
              <button
                onClick={() => { setActionSession(selectedSession); setCancelReason(''); setShowCancelModal(true); }}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm"
              >
                <XCircle className="w-4 h-4" />
                Cancel Session
              </button>
            </div>
          )}

          {(selectedSession.status === 'scheduled') && (
            <div className="mt-4">
              <button
                onClick={() => { setActionSession(selectedSession); setCancelReason(''); setShowCancelModal(true); }}
                className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Cancel / Remove Session
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mark Complete Modal */}
      {showCompleteModal && actionSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-stone-800 mb-4">Mark Session Completed</h2>
            <p className="text-stone-600 mb-4">
              Confirm that <strong>{actionSession.therapy_name}</strong> for <strong>{actionSession.patient_name}</strong> is complete.
            </p>

            <textarea
              placeholder="Add session notes or observations (optional)"
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-herb-500 focus:border-transparent resize-none h-24 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCompleteModal(false); setActionSession(null); setActionNotes(''); }}
                className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 font-semibold rounded-lg hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkComplete}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-herb-500 hover:bg-herb-600 disabled:bg-herb-300 text-white font-semibold rounded-lg transition disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'Confirm Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Plan Modal */}
      {showCancelPlanModal && cancelPlanTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-stone-800 mb-4">Cancel Treatment Plan</h2>
            <p className="text-stone-600 mb-4">
              This will cancel <strong>{cancelPlanTarget.plan_name}</strong> for <strong>{cancelPlanTarget.patient_name}</strong>.
            </p>

            <textarea
              placeholder="Provide a reason for cancellation"
              value={cancelPlanReason}
              onChange={(e) => setCancelPlanReason(e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none h-24 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCancelPlanModal(false); setCancelPlanTarget(null); setCancelPlanReason(''); }}
                className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 font-semibold rounded-lg hover:bg-stone-50 transition"
              >
                Keep Plan
              </button>
              <button
                onClick={handleCancelPlan}
                disabled={isProcessing || !cancelPlanReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-lg transition disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'Cancel Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Session Modal */}
      {showCancelModal && actionSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-stone-800 mb-4">Cancel Therapy Session</h2>
            <p className="text-stone-600 mb-4">
              This will cancel <strong>{actionSession.therapy_name}</strong> for <strong>{actionSession.patient_name}</strong> and notify the patient.
            </p>

            <textarea
              placeholder="Provide a reason for cancellation (sent to patient)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none h-24 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCancelModal(false); setActionSession(null); setCancelReason(''); }}
                className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 font-semibold rounded-lg hover:bg-stone-50 transition"
              >
                Keep Session
              </button>
              <button
                onClick={handleCancelSession}
                disabled={isProcessing || !cancelReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-lg transition disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'Cancel & Notify Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
