import { useState, useEffect } from 'react';
import { MessageSquare, Star, Send, TrendingUp, AlertCircle, Brain, Sparkles, Activity, Heart } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../api';

export default function Feedback() {
  const [patients, setPatients] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [patientFeedback, setPatientFeedback] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [form, setForm] = useState({
    session_id: '', patient_id: '', overall_rating: 3, pain_level: 3, energy_level: 3,
    sleep_quality: 3, digestion_rating: 3, symptoms_reported: '', side_effects: '',
    improvements: '', additional_notes: ''
  });

  useEffect(() => {
    Promise.all([api.getPatients(), api.getSessions()]).then(([p, s]) => {
      setPatients(p);
      setSessions(s);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;
    Promise.all([
      api.getPatientFeedback(selectedPatient),
      api.getProgressTrends(selectedPatient),
    ]).then(([f, t]) => {
      setPatientFeedback(f);
      setTrends(t);
    });
    // Load AI recommendations
    setAiLoading(true);
    Promise.all([
      api.aiRecommend(selectedPatient).catch(() => null),
      api.aiInsights(selectedPatient).then(d => d?.response_analysis || d).catch(() => null),
    ]).then(([rec, ins]) => {
      setAiRecommendations(rec);
      setAiInsights(ins);
    }).finally(() => setAiLoading(false));
  }, [selectedPatient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.submitFeedback(form);
    setShowForm(false);
    if (selectedPatient) {
      const [f, t] = await Promise.all([
        api.getPatientFeedback(selectedPatient),
        api.getProgressTrends(selectedPatient),
      ]);
      setPatientFeedback(f);
      setTrends(t);
    }
  };

  const completedSessions = sessions.filter(s => s.status === 'completed');

  const RatingStars = ({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-5 h-5 ${i <= value ? 'text-saffron-400 fill-saffron-400' : 'text-stone-300'} ${!readonly ? 'cursor-pointer' : ''}`}
          onClick={() => !readonly && onChange?.(i)}
        />
      ))}
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Patient Feedback</h1>
          <p className="text-stone-500 mt-1">Collect and analyze patient responses after each session</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-saffron-500 text-white px-4 py-2.5 rounded-lg hover:bg-saffron-600 transition-colors font-medium text-sm">
          <Send className="w-4 h-4" /> Submit Feedback
        </button>
      </div>

      {/* Patient Selector */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <label className="block text-sm font-medium text-stone-700 mb-2">Select Patient to View Feedback</label>
        <select
          value={selectedPatient}
          onChange={e => setSelectedPatient(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40"
        >
          <option value="">Choose a patient...</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Trends Chart */}
      {selectedPatient && trends.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-herb-600" />Progress Visualization</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="scheduled_date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
              <Tooltip content={({ payload, label }) => {
                if (!payload?.length) return null;
                return (
                  <div className="bg-white p-3 rounded-lg shadow-lg border text-sm">
                    <p className="font-medium mb-1">{label}</p>
                    {payload.map((p: any) => (
                      <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}/5</p>
                    ))}
                  </div>
                );
              }} />
              <Legend />
              <Line type="monotone" dataKey="overall_rating" name="Overall Rating" stroke="#ff8010" strokeWidth={2} dot={{ r: 5 }} />
              <Line type="monotone" dataKey="pain_level" name="Pain Level" stroke="#ef4444" strokeWidth={2} dot={{ r: 5 }} />
              <Line type="monotone" dataKey="energy_level" name="Energy" stroke="#1ec428" strokeWidth={2} dot={{ r: 5 }} />
              <Line type="monotone" dataKey="sleep_quality" name="Sleep Quality" stroke="#6366f1" strokeWidth={2} dot={{ r: 5 }} />
              <Line type="monotone" dataKey="digestion_rating" name="Digestion" stroke="#b47d43" strokeWidth={2} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Treatment Insights */}
      {selectedPatient && aiInsights && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            AI Treatment Insights
            <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">PERSONALIZED</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-white/80 rounded-lg p-4 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-red-500" />
                <p className="text-xs text-stone-500">Health Score</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: (aiInsights.health_score || 0) >= 70 ? '#16a34a' : (aiInsights.health_score || 0) >= 40 ? '#f59e0b' : '#ef4444' }}>
                {aiInsights.health_score?.toFixed?.(0) ?? aiInsights.health_score ?? 'N/A'}<span className="text-sm text-stone-400">/100</span>
              </p>
            </div>
            <div className="bg-white/80 rounded-lg p-4 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-herb-600" />
                <p className="text-xs text-stone-500">Sessions Analyzed</p>
              </div>
              <p className="text-lg font-bold text-herb-700">{aiInsights.total_sessions_analyzed ?? 'N/A'}</p>
            </div>
            <div className="bg-white/80 rounded-lg p-4 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-saffron-600" />
                <p className="text-xs text-stone-500">Side Effects</p>
              </div>
              <p className={`text-lg font-bold ${aiInsights.side_effects_concern ? 'text-red-600' : 'text-herb-700'}`}>
                {aiInsights.side_effects_count ?? 0} {aiInsights.side_effects_concern ? '(Concern)' : '(None)'}
              </p>
            </div>
          </div>
          {aiInsights.side_effects_concern && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />Side effects detected. Please review patient feedback history.</p>
            </div>
          )}
        </div>
      )}

      {/* AI Therapy Recommendations */}
      {selectedPatient && aiRecommendations?.recommendations?.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-saffron-500" />
            Recommended Therapies
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiRecommendations.recommendations.map((rec: any, i: number) => (
              <div key={i} className="p-4 rounded-lg border border-stone-100 hover:border-saffron-200 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-stone-900">{rec.therapy_name || rec.therapy_type_id}</p>
                    <p className="text-xs text-stone-500 capitalize">{rec.recommendation}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    rec.score >= 0.7 ? 'bg-herb-100 text-herb-800' :
                    rec.score >= 0.4 ? 'bg-saffron-100 text-saffron-800' :
                    'bg-stone-100 text-stone-600'
                  }`}>
                    {(rec.score * 100).toFixed(0)}% match
                  </span>
                </div>
                {rec.reasons?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {rec.reasons.map((r: string, j: number) => (
                      <span key={j} className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{r}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPatient && aiLoading && (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
          <div className="animate-spin w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-stone-500">AI analyzing patient data...</p>
        </div>
      )}

      {/* Feedback List */}
      {selectedPatient && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-saffron-500" />Feedback History</h3>
          {patientFeedback.length === 0 ? (
            <p className="text-stone-400 text-center py-8">No feedback submitted yet for this patient.</p>
          ) : (
            <div className="space-y-4">
              {patientFeedback.map((f: any) => (
                <div key={f.id} className="p-4 rounded-lg border border-stone-100">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-stone-900">{f.therapy_name}</p>
                      <p className="text-sm text-stone-500">{f.scheduled_date}</p>
                    </div>
                    <RatingStars value={f.overall_rating} readonly />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="bg-stone-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-stone-500">Pain</p>
                      <p className="font-medium">{f.pain_level}/5</p>
                    </div>
                    <div className="bg-stone-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-stone-500">Energy</p>
                      <p className="font-medium">{f.energy_level}/5</p>
                    </div>
                    <div className="bg-stone-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-stone-500">Sleep</p>
                      <p className="font-medium">{f.sleep_quality}/5</p>
                    </div>
                    <div className="bg-stone-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-stone-500">Digestion</p>
                      <p className="font-medium">{f.digestion_rating}/5</p>
                    </div>
                  </div>
                  {f.symptoms_reported && (
                    <p className="text-sm mt-3"><span className="text-stone-500">Symptoms:</span> {f.symptoms_reported}</p>
                  )}
                  {f.side_effects && (
                    <p className="text-sm mt-1 text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />Side Effects: {f.side_effects}</p>
                  )}
                  {f.improvements && (
                    <p className="text-sm mt-1 text-herb-600">Improvements: {f.improvements}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit Feedback Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Submit Session Feedback</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Session *</label>
                <select required value={form.session_id} onChange={e => {
                  const session = completedSessions.find((s: any) => s.id === e.target.value);
                  setForm({ ...form, session_id: e.target.value, patient_id: session?.patient_id || '' });
                }} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40">
                  <option value="">Select completed session...</option>
                  {completedSessions.map(s => (
                    <option key={s.id} value={s.id}>{s.patient_name} - {s.therapy_name} ({s.scheduled_date})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Overall Rating *</label>
                <RatingStars value={form.overall_rating} onChange={(v) => setForm({ ...form, overall_rating: v })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'pain_level', label: 'Pain Level (1=low, 5=high)' },
                  { key: 'energy_level', label: 'Energy Level' },
                  { key: 'sleep_quality', label: 'Sleep Quality' },
                  { key: 'digestion_rating', label: 'Digestion Rating' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
                    <input
                      type="range" min="1" max="5" value={(form as any)[key]}
                      onChange={e => setForm({ ...form, [key]: parseInt(e.target.value) })}
                      className="w-full accent-saffron-500"
                    />
                    <p className="text-xs text-stone-500 text-center">{(form as any)[key]}/5</p>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Symptoms Reported</label>
                <textarea value={form.symptoms_reported} onChange={e => setForm({ ...form, symptoms_reported: e.target.value })} rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Side Effects</label>
                <textarea value={form.side_effects} onChange={e => setForm({ ...form, side_effects: e.target.value })} rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Improvements Noticed</label>
                <textarea value={form.improvements} onChange={e => setForm({ ...form, improvements: e.target.value })} rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Additional Notes</label>
                <textarea value={form.additional_notes} onChange={e => setForm({ ...form, additional_notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg hover:bg-stone-50 font-medium text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-saffron-500 text-white rounded-lg hover:bg-saffron-600 font-medium text-sm">Submit Feedback</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
