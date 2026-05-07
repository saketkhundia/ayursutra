import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Calendar, Activity, TrendingUp, Clock, Star,
  ArrowUpRight, Bell, Brain, AlertTriangle, Sparkles
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';

const COLORS = ['#ff8010', '#1ec428', '#c74a07', '#13a31c', '#b47d43', '#137f1a', '#ff9d37', '#46de4e'];
const DOSHA_COLORS: Record<string, string> = {
  Vata: '#6366f1', 'Vata-Pitta': '#8b5cf6', Pitta: '#ef4444',
  'Pitta-Kapha': '#f97316', Kapha: '#22c55e', 'Vata-Kapha': '#06b6d4', Tridosha: '#eab308'
};

function StatCard({ icon: Icon, label, value, color, link }: any) {
  return (
    <Link
      to={link || '#'}
      className="bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md hover:border-stone-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400 focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-stone-400" />
      </div>
      <p className="text-2xl font-bold mt-3">{value}</p>
      <p className="text-sm text-stone-500 mt-1">{label}</p>
    </Link>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [pendingAppointments, setPendingAppointments] = useState<any[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { on, joinRoom } = useSocket();

  const loadAll = () => {
    setLoading(true);
    const doctorId = localStorage.getItem('doctor_info') ? JSON.parse(localStorage.getItem('doctor_info')!).id : null;
    Promise.all([
      api.getStats().catch(() => null),
      api.getUpcomingSessions().catch(() => []),
      api.getTherapyDistribution().catch(() => []),
      api.getWeeklySessions().catch(() => []),
      api.getPatientProgress().catch(() => []),
      api.getAiInsights().catch(() => null),
      doctorId ? api.getDoctorPendingAppointments(doctorId).catch(() => []) : Promise.resolve([]),
    ]).then(([s, u, d, w, p, ai, pending]) => {
      setStats(s);
      setUpcoming(u);
      setDistribution(d);
      setWeekly(w);
      setProgress(p);
      setAiInsights(ai);
      setPendingAppointments(pending || []);
    }).finally(() => setLoading(false));
  };

  const handleApproveAppointment = async (sessionId: string) => {
    try {
      await api.approveAppointment(sessionId, approvalNotes);
      setApprovalNotes('');
      setSelectedAppointment(null);
      loadAll();
    } catch (err) {
      console.error('Failed to approve appointment:', err);
      alert('Failed to approve appointment');
    }
  };

  const handleRejectAppointment = async (sessionId: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    try {
      await api.rejectAppointment(sessionId, rejectReason);
      setRejectReason('');
      setSelectedAppointment(null);
      loadAll();
    } catch (err) {
      console.error('Failed to reject appointment:', err);
      alert('Failed to reject appointment');
    }
  };

  useEffect(() => {
    loadAll();
    joinRoom('dashboard');
    const unsub1 = on('dashboard:refresh', loadAll);
    const unsub2 = on('pending-appointments:update', () => {
      const doctorId = localStorage.getItem('doctor_info') ? JSON.parse(localStorage.getItem('doctor_info')!).id : null;
      if (doctorId) {
        api.getDoctorPendingAppointments(doctorId).catch(() => []).then(setPendingAppointments);
      }
    });
    const unsub3 = on('appointment:request', () => {
      const doctorId = localStorage.getItem('doctor_info') ? JSON.parse(localStorage.getItem('doctor_info')!).id : null;
      if (doctorId) {
        api.getDoctorPendingAppointments(doctorId).catch(() => []).then(setPendingAppointments);
      }
    });
    return () => {
      unsub1?.();
      unsub2?.();
      unsub3?.();
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-stone-200 rounded-lg animate-pulse" />
          <div className="h-4 w-72 max-w-full bg-stone-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 h-[120px] animate-pulse">
              <div className="flex justify-between">
                <div className="w-10 h-10 rounded-lg bg-stone-200" />
                <div className="w-4 h-4 rounded bg-stone-100" />
              </div>
              <div className="h-8 w-16 bg-stone-200 rounded mt-4" />
              <div className="h-3 w-24 bg-stone-100 rounded mt-2" />
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="animate-spin w-9 h-9 border-[3px] border-saffron-200 border-t-saffron-600 rounded-full" />
          <p className="text-sm text-stone-500">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
        <p className="text-stone-500 mt-1">Welcome to AI-Based Therapy & Appointment Scheduling System</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Patients" value={stats?.totalPatients || 0} color="bg-saffron-500" link="/patients" />
        <StatCard icon={Calendar} label="Today's Sessions" value={stats?.todaySessions || 0} color="bg-herb-600" link="/scheduling" />
        <StatCard icon={Activity} label="Active Plans" value={stats?.activePlans || 0} color="bg-earth-600" link="/tracking" />
        <StatCard icon={Star} label="Avg Rating" value={stats?.averageRating || 0} color="bg-saffron-700" link="/feedback" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Clock} label="Upcoming Sessions" value={stats?.upcomingSessions || 0} color="bg-herb-700" link="/scheduling" />
        <StatCard icon={TrendingUp} label="Completed Sessions" value={stats?.completedSessions || 0} color="bg-earth-700" link="/tracking" />
        <StatCard icon={Bell} label="Unread Notifications" value={stats?.unreadNotifications || 0} color="bg-saffron-600" link="/notifications" />
      </div>

      {/* Pending Appointments Panel */}
      {pendingAppointments.length > 0 && (
        <div className="bg-orange-50 rounded-xl border-2 border-orange-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            Pending Appointment Requests
            <span className="ml-2 inline-flex items-center justify-center bg-orange-600 text-white text-xs font-bold rounded-full w-6 h-6">
              {pendingAppointments.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingAppointments.map((apt: any) => (
              <div key={apt.id} className="bg-white rounded-lg border border-orange-100 p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-stone-900">{apt.patient_name || 'Patient'}</h4>
                    <p className="text-xs text-stone-500 mt-0.5">{apt.patient_email}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    {apt.status}
                  </span>
                </div>
                
                <div className="space-y-2 mb-3 text-sm text-stone-600">
                  <p><strong>Dosha:</strong> {apt.dosha_type || 'N/A'}</p>
                  <p><strong>Therapy:</strong> {apt.therapy_type || 'N/A'}</p>
                  <p><strong>Requested Date:</strong> {new Date(apt.scheduled_date).toLocaleDateString()}</p>
                  <p><strong>Duration:</strong> {apt.duration_days || 7} days</p>
                </div>

                {selectedAppointment === apt.id ? (
                  <div className="space-y-3 border-t border-orange-100 pt-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Approval Notes (optional)</label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Add any notes..."
                        className="w-full px-2 py-1 text-xs border border-stone-200 rounded focus:ring-1 focus:ring-herb-400 focus:border-transparent"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Rejection Reason (if rejecting)</label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        className="w-full px-2 py-1 text-xs border border-stone-200 rounded focus:ring-1 focus:ring-red-400 focus:border-transparent"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveAppointment(apt.id)}
                        className="flex-1 py-1.5 px-3 bg-herb-600 hover:bg-herb-700 text-white text-xs font-medium rounded transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectAppointment(apt.id)}
                        className="flex-1 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAppointment(null);
                          setApprovalNotes('');
                          setRejectReason('');
                        }}
                        className="flex-1 py-1.5 px-3 bg-stone-200 hover:bg-stone-300 text-stone-900 text-xs font-medium rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedAppointment(apt.id)}
                    className="w-full py-1.5 px-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded transition-colors"
                  >
                    Review & Decide
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights Panel */}
      {aiInsights && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            AI-Powered Insights
            <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-1">BETA</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/80 rounded-lg p-4 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-herb-600" />
                <p className="text-xs text-stone-500">30-Day Completion Rate</p>
              </div>
              <p className="text-2xl font-bold text-herb-700">{aiInsights.completionRate?.toFixed(1) || 0}%</p>
            </div>
            <div className="bg-white/80 rounded-lg p-4 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="text-xs text-stone-500">Side Effects Reported</p>
              </div>
              <p className="text-2xl font-bold text-amber-700">{aiInsights.sideEffectsCount || 0}</p>
            </div>
            <div className="bg-white/80 rounded-lg p-4 border border-indigo-100 col-span-1 sm:col-span-2">
              <p className="text-xs text-stone-500 mb-2">Top Rated Therapies</p>
              <div className="flex flex-wrap gap-2">
                {(aiInsights.topTherapies || []).slice(0, 4).map((t: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs font-medium bg-saffron-100 text-saffron-800 px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-saffron-400 text-saffron-400" />{t.name} ({t.avg_rating?.toFixed(1)})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Dosha Distribution & Schedule Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {aiInsights.doshaDistribution?.length > 0 && (
              <div className="bg-white/80 rounded-lg p-4 border border-indigo-100">
                <p className="text-xs font-medium text-stone-500 mb-3">Patient Dosha Distribution</p>
                <div className="space-y-2">
                  {aiInsights.doshaDistribution.map((d: any) => (
                    <div key={d.dosha} className="flex items-center gap-2">
                      <span className="text-xs w-20 text-stone-600 truncate">{d.dosha}</span>
                      <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${(d.count / (aiInsights.doshaDistribution.reduce((s: number, x: any) => s + x.count, 0) || 1)) * 100}%`, backgroundColor: DOSHA_COLORS[d.dosha] || '#94a3b8' }}
                        />
                      </div>
                      <span className="text-xs font-medium w-6 text-right">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiInsights.scheduleHeatmap?.length > 0 && (
              <div className="bg-white/80 rounded-lg p-4 border border-indigo-100">
                <p className="text-xs font-medium text-stone-500 mb-3">Schedule Density by Day</p>
                <div className="space-y-1.5">
                  {(() => {
                    const dayTotals: Record<string, number> = {};
                    for (const h of aiInsights.scheduleHeatmap) {
                      dayTotals[h.day] = (dayTotals[h.day] || 0) + h.count;
                    }
                    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    const maxCount = Math.max(...Object.values(dayTotals), 1);
                    return days.filter(d => dayTotals[d]).map(day => (
                      <div key={day} className="flex items-center gap-2">
                        <span className="text-xs w-8 text-stone-600">{day}</span>
                        <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-saffron-500 rounded-full transition-all" style={{ width: `${(dayTotals[day] / maxCount) * 100}%`, opacity: 0.5 + (dayTotals[day] / maxCount) * 0.5 }} />
                        </div>
                        <span className="text-xs font-medium w-6 text-right">{dayTotals[day]}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session Trends */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4">Session Activity (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="scheduled_date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Total" fill="#ff8010" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#13a31c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Therapy Distribution */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4">Therapy Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={distribution} cx="50%" cy="50%" outerRadius={90} dataKey="session_count" nameKey="name" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {distribution.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Patient Progress */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 lg:col-span-2">
          <h3 className="font-semibold text-stone-900 mb-4">Patient Progress Overview</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={progress} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="patient_name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="completed_sessions" name="Completed" fill="#13a31c" radius={[0, 4, 4, 0]} />
              <Bar dataKey="total_sessions" name="Total" fill="#ffc170" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming Sessions Table */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-stone-900">Upcoming Sessions</h3>
          <Link to="/scheduling" className="text-sm text-saffron-600 hover:text-saffron-700 font-medium">View All →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left py-2 px-3 font-medium text-stone-500">Date</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Time</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Patient</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Therapy</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Practitioner</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((s: any) => (
                <tr key={s.id} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="py-2.5 px-3">{s.scheduled_date}</td>
                  <td className="py-2.5 px-3">{s.scheduled_time}</td>
                  <td className="py-2.5 px-3 font-medium">{s.patient_name}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-saffron-100 text-saffron-800">
                      {s.therapy_name}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">{s.practitioner_name}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-herb-100 text-herb-800">
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {upcoming.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-stone-400">No upcoming sessions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
