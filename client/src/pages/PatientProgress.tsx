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
        <div className="animate-spin w-8 h-8 border-4 border-[#4E9A6F] border-t-transparent rounded-full" />
        <p className="text-sm text-[#7A7570]">Loading your therapy progress…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">My Therapy Progress</h1>
          <p className="text-[#7A7570] mt-1">
            The same plans and sessions your practitioners see — updates appear here in real time.
          </p>
        </div>
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${connected ? 'bg-[#EDF4EF] text-[#4E9A6F]' : 'bg-[#F7F5F0] text-[#7A7570]'}`}>
          {connected ? <><Wifi className="w-3 h-3" /> Synced live</> : <><WifiOff className="w-3 h-3" /> Reconnecting…</>}
        </div>
      </div>

      <div className="flex items-start gap-3 bg-[#EDF4EF] border border-[#C5DDD0] rounded-xl px-4 py-3">
        <Sparkles className="w-5 h-5 text-[#4E9A6F] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[#1C1C1C]">
          When your doctor marks a session complete or updates your plan, this page refreshes automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E8E3DA] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F7F5F0] flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#4E9A6F]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeSessions.length}</p>
              <p className="text-sm text-[#7A7570]">In progress now</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E3DA] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F7F5F0] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#4E9A6F]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todaySessions.length}</p>
              <p className="text-sm text-[#7A7570]">Today&apos;s sessions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E3DA] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F7F5F0] flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[#4E9A6F]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedSessions.length}</p>
              <p className="text-sm text-[#7A7570]">Completed total</p>
            </div>
          </div>
        </div>
      </div>

      {activeSessions.length > 0 && (
        <div className="bg-[#EDF4EF] rounded-xl border border-[#C5DDD0] p-5">
          <h3 className="font-semibold text-[#1C1C1C] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-[#4E9A6F] rounded-full animate-pulse" />
            Live session
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSessions.map(s => (
              <div key={s.id} className="bg-white rounded-lg p-4 border border-[#C5DDD0]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-[#4E9A6F] font-medium">{s.therapy_name}</p>
                    <p className="text-xs text-[#7A7570] mt-1">with {s.practitioner_name}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-[#EDF4EF] text-[#4E9A6F] rounded-full">In progress</span>
                </div>
                <p className="text-xs text-[#7A7570] mt-2">{s.duration_minutes} min session</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {planProgress.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E8E3DA] p-5">
          <h3 className="font-semibold text-[#1C1C1C] mb-4">Your treatment plan progress</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planProgress} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E3DA" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#7A7570' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#7A7570' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#F7F5F0'}} />
                <Legend />
                <Bar dataKey="completed" name="Completed" fill="#4E9A6F" stackId="a" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="remaining" name="Remaining" fill="#C9A96E" stackId="a" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {milestones.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E8E3DA] p-5">
          <h3 className="font-semibold text-[#1C1C1C] mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-[#4E9A6F]" />
            Recovery milestones
          </h3>
          <ul className="space-y-2">
            {milestones.map((m: any) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[#F7F5F0] border border-[#E8E3DA]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#1C1C1C] text-sm truncate">{m.milestone_name}</p>
                  <p className="text-xs text-[#7A7570]">{m.plan_name}{m.target_date ? ` · target ${m.target_date}` : ''}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                    m.status === 'achieved' ? 'bg-[#EDF4EF] text-[#4E9A6F]' : 'bg-[#E8E3DA] text-[#7A7570]'
                  }`}
                >
                  {m.status === 'achieved' ? 'Achieved' : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E8E3DA] p-5">
        <h3 className="font-semibold text-[#1C1C1C] mb-4">Your treatment plans</h3>
        {plans.length === 0 ? (
          <p className="text-sm text-[#7A7570] py-6 text-center">
            No active treatment plans yet.
          </p>
        ) : (
          <div className="space-y-4">
            {plans.map(plan => {
              const planSessions = sessions.filter((s: any) => s.treatment_plan_id === plan.id);
              const completed = planSessions.filter((s: any) => s.status === 'completed').length;
              const total = planSessions.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <div key={plan.id} className="p-4 bg-[#F7F5F0] rounded-lg border border-[#E8E3DA]">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div>
                      <h4 className="font-medium text-[#1C1C1C]">{plan.plan_name}</h4>
                      <p className="text-sm text-[#5A5550]">Dr. {plan.practitioner_name}</p>
                      <p className="text-xs text-[#7A7570] mt-1">{plan.start_date} → {plan.end_date}</p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                        plan.status === 'active' ? 'bg-[#EDF4EF] text-[#4E9A6F]' : 'bg-[#E8E3DA] text-[#7A7570]'
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-[#E8E3DA] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4E9A6F] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[#1C1C1C] w-12 text-right">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E8E3DA] p-5">
        <h3 className="font-semibold text-[#1C1C1C] mb-4">Your sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-[#7A7570] py-8 text-center">No sessions scheduled yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.slice(0, 18).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                className="text-left p-4 rounded-lg border border-[#E8E3DA] hover:border-[#4E9A6F] hover:bg-[#EDF4EF]/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4E9A6F]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm text-[#1C1C1C]">{s.therapy_name}</p>
                    <p className="text-xs text-[#7A7570]">{s.practitioner_name}</p>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      s.status === 'completed'
                        ? 'bg-[#EDF4EF] text-[#4E9A6F]'
                        : s.status === 'scheduled'
                          ? 'bg-[#F7F5F0] text-[#7A7570]'
                          : s.status === 'in-progress'
                            ? 'bg-[#EDF4EF] text-[#4E9A6F]'
                            : 'bg-[#F7F5F0] text-[#7A7570]'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-[#7A7570] mt-2">
                  {s.scheduled_date} · {s.scheduled_time}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSession && (
        <div className="bg-white rounded-xl border border-[#E8E3DA] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#1C1C1C] flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#4E9A6F]" />
              Session details
            </h3>
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="text-sm text-[#7A7570] hover:text-[#1C1C1C]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-[#7A7570] mb-1">Therapy</p>
              <p className="font-medium text-[#1C1C1C]">{selectedSession.therapy_name}</p>
            </div>
            <div>
              <p className="text-[#7A7570] mb-1">Practitioner</p>
              <p className="font-medium text-[#1C1C1C]">{selectedSession.practitioner_name}</p>
            </div>
            <div>
              <p className="text-[#7A7570] mb-1">Duration</p>
              <p className="font-medium text-[#1C1C1C]">{selectedSession.duration_minutes} min</p>
            </div>
            <div>
              <p className="text-[#7A7570] mb-1">Status</p>
              <p className="font-medium text-[#1C1C1C] capitalize">{selectedSession.status}</p>
            </div>
          </div>
          {selectedSession.pre_procedure_instructions && (
            <div className="mt-6 p-4 bg-[#EDF4EF] border border-[#C5DDD0] rounded-lg">
              <p className="text-sm font-semibold text-[#4E9A6F] flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Pre-procedure notes
              </p>
              <p className="text-sm text-[#1C1C1C] leading-relaxed whitespace-pre-line">{selectedSession.pre_procedure_instructions}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
