import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Clock, CheckCircle, Eye, AlertTriangle, Wifi, WifiOff, Sparkles, Flag,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api, userAuth } from '../api';
import { useSocket } from '../hooks/useSocket';

export default function PatientProgress() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { connected, on, joinPatientChannel } = useSocket();

  const user = userAuth.getUser();
  const patientId = user?.id as string | undefined;

  const loadData = useCallback((showSpinner = false) => {
    if (!patientId) return;
    if (showSpinner) setLoading(true);
    api
      .getPatientTherapyProgress()
      .then(({ sessions: s, plans: p, milestones: m }) => {
        setSessions(s || []);
        setPlans(p || []);
        setMilestones(m || []);
      })
      .catch(() => {
        setSessions([]);
        setPlans([]);
        setMilestones([]);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (!patientId) return;
    joinPatientChannel(patientId);
    const unsubs = [
      on('therapy-progress:refresh', () => loadData(false)),
      on('session:updated', () => loadData(false)),
      on('session:created', () => loadData(false)),
    ];
    return () => unsubs.forEach(u => u());
  }, [patientId, on, joinPatientChannel, loadData]);

  const activeSessions = sessions.filter(s => s.status === 'in-progress');
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s => s.scheduled_date === todayStr);
  const completedSessions = sessions.filter(s => s.status === 'completed');

  const planProgress = plans.map(plan => {
    const planSessions = sessions.filter(s => s.treatment_plan_id === plan.id);
    const completed = planSessions.filter(s => s.status === 'completed').length;
    const total = planSessions.length;
    return { name: plan.plan_name?.substring(0, 22) || 'Plan', completed, total, remaining: Math.max(0, total - completed) };
  });

  if (loading && sessions.length === 0 && plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <div className="animate-spin w-9 h-9 border-[3px] border-emerald-200 border-t-emerald-600 rounded-full" />
        <p className="text-sm text-stone-500">Loading your therapy progress…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">My Therapy Progress</h1>
          <p className="text-stone-500 mt-1">
            The same plans and sessions your practitioners see — updates appear here in real time.
          </p>
        </div>
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${connected ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
          {connected ? <><Wifi className="w-3 h-3" /> Synced live</> : <><WifiOff className="w-3 h-3" /> Reconnecting…</>}
        </div>
      </div>

      <div className="flex items-start gap-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-4 py-3">
        <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-900">
          When your doctor marks a session complete or updates your plan, this page refreshes automatically so you always share one view of your care.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeSessions.length}</p>
              <p className="text-sm text-stone-500">In progress now</p>
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
              <p className="text-sm text-stone-500">Today&apos;s sessions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedSessions.length}</p>
              <p className="text-sm text-stone-500">Completed total</p>
            </div>
          </div>
        </div>
      </div>

      {activeSessions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-saffron-50 rounded-xl border border-amber-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Live session
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSessions.map(s => (
              <div key={s.id} className="bg-white rounded-lg p-4 border border-amber-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-saffron-800 font-medium">{s.therapy_name}</p>
                    <p className="text-xs text-stone-500 mt-1">with {s.practitioner_name}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-800 rounded-full">In progress</span>
                </div>
                <p className="text-xs text-stone-500 mt-2">{s.duration_minutes} min session</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {planProgress.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4">Your treatment plan progress</h3>
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

      {milestones.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-saffron-600" />
            Recovery milestones
          </h3>
          <ul className="space-y-2">
            {milestones.map((m: any) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-stone-50 border border-stone-100"
              >
                <div className="min-w-0">
                  <p className="font-medium text-stone-800 text-sm truncate">{m.milestone_name}</p>
                  <p className="text-xs text-stone-500">{m.plan_name}{m.target_date ? ` · target ${m.target_date}` : ''}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                    m.status === 'achieved' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {m.status === 'achieved' ? 'Achieved' : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-900 mb-4">Your treatment plans</h3>
        {plans.length === 0 ? (
          <p className="text-sm text-stone-500 py-6 text-center">
            No active treatment plans yet. When your practitioner creates a plan for you, it will show here.
          </p>
        ) : (
          <div className="space-y-4">
            {plans.map(plan => {
              const planSessions = sessions.filter((s: any) => s.treatment_plan_id === plan.id);
              const completed = planSessions.filter((s: any) => s.status === 'completed').length;
              const total = planSessions.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <div key={plan.id} className="p-4 bg-stone-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div>
                      <h4 className="font-medium text-stone-900">{plan.plan_name}</h4>
                      <p className="text-sm text-stone-500">Dr. {plan.practitioner_name}</p>
                      <p className="text-xs text-stone-400 mt-1">{plan.start_date} → {plan.end_date}</p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                        plan.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-saffron-500 to-emerald-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-stone-700 w-20 text-right tabular-nums">
                      {completed}/{total} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-900 mb-4">Your sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-stone-500 py-8 text-center">No sessions scheduled yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.slice(0, 18).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                className="text-left p-4 rounded-lg border border-stone-100 hover:border-saffron-200 hover:bg-saffron-50/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{s.therapy_name}</p>
                    <p className="text-xs text-stone-500">{s.practitioner_name}</p>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      s.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : s.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-800'
                          : s.status === 'in-progress'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-2">
                  {s.scheduled_date} · {s.scheduled_time}
                </p>
                {s.progress_score != null && (
                  <div className="mt-2">
                    <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.progress_score}%` }} />
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5">Progress score: {s.progress_score}%</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSession && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-saffron-500" />
              Session details
            </h3>
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="text-sm text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-stone-500">Therapy</p>
              <p className="font-medium">{selectedSession.therapy_name}</p>
            </div>
            <div>
              <p className="text-stone-500">Practitioner</p>
              <p className="font-medium">{selectedSession.practitioner_name}</p>
            </div>
            <div>
              <p className="text-stone-500">Duration</p>
              <p className="font-medium">{selectedSession.duration_minutes} min</p>
            </div>
            <div>
              <p className="text-stone-500">Status</p>
              <p className="font-medium capitalize">{selectedSession.status}</p>
            </div>
            <div>
              <p className="text-stone-500">Date</p>
              <p className="font-medium">{selectedSession.scheduled_date}</p>
            </div>
            <div>
              <p className="text-stone-500">Time</p>
              <p className="font-medium">{selectedSession.scheduled_time}</p>
            </div>
            {selectedSession.progress_score != null && (
              <div>
                <p className="text-stone-500">Progress</p>
                <p className="font-medium">{selectedSession.progress_score}%</p>
              </div>
            )}
          </div>
          {selectedSession.pre_procedure_instructions && (
            <div className="mt-4 p-3 bg-saffron-50 border border-saffron-200 rounded-lg">
              <p className="text-sm font-medium text-saffron-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Pre-procedure notes
              </p>
              <p className="text-sm text-saffron-800 mt-1 whitespace-pre-line">{selectedSession.pre_procedure_instructions}</p>
            </div>
          )}
          {selectedSession.post_procedure_instructions && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Post-procedure notes
              </p>
              <p className="text-sm text-emerald-900 mt-1 whitespace-pre-line">{selectedSession.post_procedure_instructions}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
