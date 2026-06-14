import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, MapPin, AlertCircle, Activity, Calendar, Target, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any>({ plans: [], sessions: [] });
  const [trends, setTrends] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [treatmentPlans, setTreatmentPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { on, joinPatientChannel, leaveRoom } = useSocket();

  const loadPatientData = () => {
    if (!id) return;
    Promise.all([
      api.getPatient(id).catch(() => null),
      api.getPatientHistory(id).catch(() => ({ plans: [], sessions: [] })),
      api.getProgressTrends(id).catch(() => []),
      api.getPatientMilestones(id).catch(() => []),
      api.getPatientTreatmentPlans(id).catch(() => []),
    ]).then(([p, h, t, m, plans]) => {
      setPatient(p);
      setHistory(h || { plans: [], sessions: [] });
      setTrends(t || []);
      setMilestones(m || []);
      setTreatmentPlans(plans || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPatientData();
    if (id) {
      joinPatientChannel(id);
      const unsub = on('treatment-plan:created', loadPatientData);
      return () => {
        unsub();
        leaveRoom(`patient:${id}`);
      };
    }
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full" /></div>;
  if (!patient) return <div className="text-center py-12 text-stone-400">Patient not found</div>;

  const completedSessions = history.sessions.filter((s: any) => s.status === 'completed');
  const scheduledSessions = history.sessions.filter((s: any) => s.status === 'scheduled');

  // Calculate latest feedback averages for radar chart
  const radarData = trends.length > 0 ? (() => {
    const latest = trends[trends.length - 1];
    return [
      { metric: 'Overall', value: latest.overall_rating || 0, max: 5 },
      { metric: 'Energy', value: latest.energy_level || 0, max: 5 },
      { metric: 'Sleep', value: latest.sleep_quality || 0, max: 5 },
      { metric: 'Digestion', value: latest.digestion_rating || 0, max: 5 },
      { metric: 'Pain (inv)', value: latest.pain_level ? 6 - latest.pain_level : 0, max: 5 },
    ];
  })() : [];

  return (
    <div className="space-y-6">
      <Link to="/patients" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
        <ArrowLeft className="w-4 h-4" /> Back to Patients
      </Link>

      {/* Patient Info Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-saffron-100 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-saffron-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-stone-900">{patient.name}</h1>
            <p className="text-stone-500 mt-1">{patient.age} years &middot; {patient.gender}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {patient.prakriti && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-herb-100 text-herb-800">Prakriti: {patient.prakriti}</span>}
              {patient.current_dosha_imbalance && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-saffron-100 text-saffron-800">Imbalance: {patient.current_dosha_imbalance}</span>}
              {patient.allergies && patient.allergies !== 'None' && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-800">Allergies: {patient.allergies}</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
              {patient.phone && <p className="flex items-center gap-2 text-stone-600"><Phone className="w-4 h-4 text-stone-400" />{patient.phone}</p>}
              {patient.email && <p className="flex items-center gap-2 text-stone-600"><Mail className="w-4 h-4 text-stone-400" />{patient.email}</p>}
              {patient.address && <p className="flex items-center gap-2 text-stone-600"><MapPin className="w-4 h-4 text-stone-400" />{patient.address}</p>}
            </div>
            {patient.medical_history && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-800"><AlertCircle className="w-4 h-4" />Medical History</p>
                <p className="text-sm text-amber-700 mt-1">{patient.medical_history}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 text-center">
            <div className="bg-herb-50 rounded-lg px-4 py-3">
              <p className="text-2xl font-bold text-herb-700">{completedSessions.length}</p>
              <p className="text-xs text-herb-600">Completed</p>
            </div>
            <div className="bg-saffron-50 rounded-lg px-4 py-3">
              <p className="text-2xl font-bold text-saffron-700">{scheduledSessions.length}</p>
              <p className="text-xs text-saffron-600">Upcoming</p>
            </div>
          </div>
        </div>
      </div>

      {/* Treatment Timeline */}
      {treatmentPlans.length > 0 && (
        <div className="bg-green-50 rounded-xl border-2 border-green-200 p-6">
          <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            Active Treatment Plans
          </h3>
          <div className="space-y-4">
            {treatmentPlans.map((plan: any) => (
              <div key={plan.id} className="bg-white rounded-lg border border-green-100 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-stone-900">Panchakarma Course</h4>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {new Date(plan.start_date).toLocaleDateString()} · {plan.therapy_sequence?.length || 0} sessions planned
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    plan.status === 'active' ? 'bg-green-100 text-green-800' :
                    plan.status === 'completed' ? 'bg-herb-100 text-herb-800' :
                    'bg-stone-100 text-stone-800'
                  }`}>
                    {plan.status}
                  </span>
                </div>

                {plan.therapy_sequence && plan.therapy_sequence.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-stone-600 mb-3">Therapy Sequence</p>
                    <div className="space-y-2">
                      {plan.therapy_sequence.map((therapy: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-2 rounded bg-green-50">
                          <div className="flex-shrink-0">
                            {therapy.status === 'completed' ? (
                              <CheckCircle className="w-5 h-5 text-herb-600" />
                            ) : therapy.status === 'in_progress' ? (
                              <Calendar className="w-5 h-5 text-saffron-600 animate-pulse" />
                            ) : (
                              <Calendar className="w-5 h-5 text-stone-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900">{therapy.name}</p>
                            <p className="text-xs text-stone-500">
                              {therapy.scheduled_date ? new Date(therapy.scheduled_date).toLocaleDateString() : 'Pending'} 
                              {therapy.duration_days ? ` · ${therapy.duration_days} days` : ''}
                            </p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            therapy.status === 'completed' ? 'bg-herb-100 text-herb-800' :
                            therapy.status === 'in_progress' ? 'bg-saffron-100 text-saffron-800' :
                            'bg-stone-100 text-stone-700'
                          }`}>
                            {therapy.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trends.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-saffron-500" />Progress Trends</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="scheduled_date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="overall_rating" name="Overall" stroke="#ff8010" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="energy_level" name="Energy" stroke="#1ec428" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="sleep_quality" name="Sleep" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {radarData.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-semibold text-stone-900 mb-4">Latest Health Snapshot</h3>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e5e5" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                <Radar name="Score" dataKey="value" stroke="#ff8010" fill="#ff8010" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recovery Milestones */}
      {milestones.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-herb-600" />Recovery Milestones</h3>
          <div className="space-y-3">
            {milestones.map((m: any) => (
              <div key={m.id} className="flex items-center gap-4 p-3 rounded-lg bg-stone-50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.status === 'achieved' ? 'bg-herb-500 text-white' :
                  m.status === 'in-progress' ? 'bg-saffron-500 text-white' :
                  'bg-stone-200 text-stone-500'
                }`}>
                  {m.status === 'achieved' ? '✓' : m.status === 'in-progress' ? '…' : '○'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900">{m.milestone_name}</p>
                  <p className="text-sm text-stone-500">{m.description}</p>
                </div>
                <div className="text-right text-sm flex-shrink-0">
                  <p className="text-stone-500">Target: {m.target_date}</p>
                  {m.achieved_date && <p className="text-herb-600 font-medium">Achieved: {m.achieved_date}</p>}
                </div>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-stone-600 mb-1">
              <span>Overall Progress</span>
              <span>{Math.round((milestones.filter((m: any) => m.status === 'achieved').length / milestones.length) * 100)}%</span>
            </div>
            <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-herb-500 to-herb-400 rounded-full transition-all"
                style={{ width: `${(milestones.filter((m: any) => m.status === 'achieved').length / milestones.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Treatment Plans & Sessions */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-earth-600" />Treatment Plans</h3>
        {history.plans.map((plan: any) => (
          <div key={plan.id} className="p-4 bg-stone-50 rounded-lg mb-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-stone-900">{plan.plan_name}</h4>
                <p className="text-sm text-stone-500 mt-1">{plan.diagnosis}</p>
                <p className="text-xs text-stone-400 mt-1">Dr. {plan.practitioner_name} &middot; {plan.start_date} to {plan.end_date}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                plan.status === 'active' ? 'bg-herb-100 text-herb-800' : 'bg-stone-100 text-stone-600'
              }`}>{plan.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Session History */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-900 mb-4">Session History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left py-2 px-3 font-medium text-stone-500">Date</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Time</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Therapy</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Category</th>
                <th className="text-left py-2 px-3 font-medium text-stone-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.sessions.map((s: any) => (
                <tr key={s.id} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="py-2.5 px-3">{s.scheduled_date}</td>
                  <td className="py-2.5 px-3">{s.scheduled_time}</td>
                  <td className="py-2.5 px-3 font-medium">{s.therapy_name}</td>
                  <td className="py-2.5 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-earth-100 text-earth-700">{s.category}</span></td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.status === 'completed' ? 'bg-herb-100 text-herb-800' :
                      s.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      s.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-stone-100 text-stone-600'
                    }`}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
