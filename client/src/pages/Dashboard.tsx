import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, Brain, ArrowUpRight, AlertTriangle, Users, Clock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { api, userAuth } from '../api';
import { useSocket } from '../hooks/useSocket';

const COLORS = ['#4E9A6F', '#7A9E8A', '#C9A96E', '#5A5550', '#8c7043'];
const DOSHA_COLORS: Record<string, string> = {
  Vata: '#C9A96E',
  Pitta: '#D47559',
  Kapha: '#4E9A6F',
};

function StatCard({ label, value, subtext, link }: any) {
  return (
    <Link
      to={link || '#'}
      className="bg-white rounded-[10px] border border-[#E8E3DA] p-5 px-6 hover:border-[#4E9A6F] transition-all duration-200 group no-underline"
    >
      <div className="flex justify-between items-start">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[#7A7570] uppercase">{label}</p>
        <ArrowUpRight className="w-4 h-4 text-[#4E9A6F] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-[36px] font-bold text-[#1C1C1C] mt-2 leading-none">{value}</p>
      <p className="text-[13px] font-normal text-[#4E9A6F] mt-2">{subtext}</p>
    </Link>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { on, joinRoom } = useSocket();

  const user = userAuth.getUser();
  const doctorName = user?.name || '';
  const peakSchedule = aiInsights?.scheduleHeatmap?.length
    ? [...aiInsights.scheduleHeatmap].sort((a: any, b: any) => b.count - a.count)[0]
    : null;

  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      api.getStats().catch(() => null),
      api.getUpcomingSessions().catch(() => []),
      api.getTherapyDistribution().catch(() => []),
      api.getWeeklySessions().catch(() => []),
      api.getAiInsights().catch(() => null),
    ]).then(([s, u, d, w, ai]) => {
      setStats(s);
      setUpcoming(u);
      setDistribution(d);
      setWeekly(w);
      setAiInsights(ai);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    joinRoom('dashboard');
    const unsub = on('dashboard:refresh', loadAll);
    return () => unsub?.();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-8 h-8 border-4 border-[#4E9A6F] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-[#7A7570]">Gathering insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
      <div>
        <h1 className="text-[20px] font-medium text-[#1C1C1C]">{timeGreeting()}, Dr. {doctorName} 👋</h1>
      </div>

      {/* Primary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard 
          label="Today's Sessions" 
          value={stats?.todaySessions ?? "0"} 
          subtext={stats?.todaySessions ? `${stats.todaySessions} session${stats.todaySessions !== 1 ? 's' : ''} today` : 'No sessions today'} 
          link="/scheduling" 
        />
        <StatCard 
          label="Completion Rate" 
          value={`${aiInsights?.completionRate ?? "0"}%`} 
          subtext={aiInsights?.totalSessionsMonth ? `Based on ${aiInsights.totalSessionsMonth} session${aiInsights.totalSessionsMonth !== 1 ? 's' : ''} this month` : 'No data this month'} 
          link="/tracking" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Sessions */}
        <div className="bg-white rounded-[10px] border border-[#E8E3DA] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[14px] font-semibold text-[#1C1C1C]">Upcoming Sessions</h2>
            <Link to="/scheduling" className="text-[13px] text-[#4E9A6F] no-underline hover:underline">View all</Link>
          </div>
          
          <div className="space-y-0">
            {upcoming.slice(0, 4).map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-4 border-b border-[#F0EDE6] last:border-none">
                <div className="space-y-1">
                  <p className="text-[14px] font-medium text-[#1C1C1C]">{s.patient_name}</p>
                  <p className="text-[13px] text-[#7A7570]">{s.therapy_name}</p>
                </div>
                <p className="text-[13px] font-medium text-[#1C1C1C]">{s.scheduled_time}</p>
              </div>
            ))}
            {upcoming.length === 0 && (
              <p className="py-8 text-center text-[#7A7570] text-sm italic">No sessions scheduled for today</p>
            )}
          </div>
        </div>

        {/* AI Insights & Distribution */}
        <div className="space-y-6">
          <div className="bg-white rounded-[10px] border border-[#E8E3DA] p-6">
            <h2 className="text-[14px] font-semibold text-[#1C1C1C] mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#4E9A6F]" />
              AI Therapy Insights
            </h2>

            {(aiInsights?.topTherapies?.length || aiInsights?.doshaDistribution?.length || aiInsights?.sideEffectsCount > 0 || peakSchedule) ? (
            <div className="space-y-5">

              {aiInsights?.topTherapies?.length > 0 && (
              <div className="flex items-center gap-4 pb-4 border-b border-[#F0EDE6]">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-[#7A7570] uppercase mb-1">Top Rated Therapy</p>
                  <p className="text-[16px] font-medium text-[#1C1C1C]">{aiInsights.topTherapies[0].name}</p>
                  <p className="text-[12px] text-[#7A7570] mt-0.5">Rating: {aiInsights.topTherapies[0].avg_rating} / 5 ({aiInsights.topTherapies[0].feedback_count} reviews)</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#EDF4EF] flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-[#4E9A6F] fill-[#4E9A6F]" />
                </div>
              </div>
              )}

              {aiInsights?.doshaDistribution?.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-[#7A7570] uppercase mb-3 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Patient Dosha Profile
                </p>
                <div className="space-y-2.5">
                  {aiInsights.doshaDistribution.map((d: any) => {
                    const maxCount = Math.max(...aiInsights.doshaDistribution.map((x: any) => x.count));
                    return (
                    <div key={d.dosha} className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: DOSHA_COLORS[d.dosha] || '#7A9E8A'}} />
                      <span className="text-[13px] text-[#1C1C1C] font-medium w-14">{d.dosha}</span>
                      <div className="flex-1 h-2 bg-[#F0EDE6] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{width: `${(d.count / maxCount) * 100}%`, backgroundColor: DOSHA_COLORS[d.dosha] || '#7A9E8A'}}
                        />
                      </div>
                      <span className="text-[12px] text-[#7A7570] w-20 text-right">{d.count} patient{d.count !== 1 ? 's' : ''}</span>
                    </div>
                    );
                  })}
                </div>
              </div>
              )}

              {aiInsights?.sideEffectsCount > 0 && (
              <div className="flex items-center gap-3 p-3 bg-[#FFF9F0] rounded-[8px] border border-[#F0E6D0]">
                <AlertTriangle className="w-4 h-4 text-[#C9A96E] shrink-0" />
                <p className="text-[13px] text-[#5A5550]">
                  <strong>{aiInsights.sideEffectsCount}</strong> patient{aiInsights.sideEffectsCount !== 1 ? 's' : ''} reported side effects this month
                </p>
              </div>
              )}

              {peakSchedule && (
              <div className="flex items-center gap-3 text-[13px] text-[#5A5550]">
                <Clock className="w-4 h-4 text-[#4E9A6F] shrink-0" />
                <span>Peak time: <strong>{peakSchedule.day}s @ {peakSchedule.hour}</strong> ({peakSchedule.count} session{peakSchedule.count !== 1 ? 's' : ''})</span>
              </div>
              )}
            </div>
            ) : (
              <div className="py-6 text-center">
                <Brain className="w-10 h-10 text-[#D4CFC8] mx-auto mb-3" />
                <p className="text-[13px] text-[#7A7570] italic leading-relaxed">
                  No AI insights yet. Start booking sessions and collecting patient feedback to unlock personalized therapy analytics.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[10px] border border-[#E8E3DA] p-6">
            <h2 className="text-[14px] font-semibold text-[#1C1C1C] mb-4">Therapy Distribution</h2>
            {distribution.length > 0 ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={distribution.map((d: any) => ({ ...d, name: d.name || 'Unknown Therapy' }))}
                    cx="50%" 
                    cy="50%" 
                    innerRadius={45}
                    outerRadius={70} 
                    paddingAngle={4}
                    dataKey="session_count"
                  >
                    {distribution.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            ) : (
              <p className="text-[13px] text-[#7A7570] italic py-4 text-center">No therapy distribution data</p>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div className="bg-white rounded-[10px] border border-[#E8E3DA] p-6">
        <h2 className="text-[14px] font-semibold text-[#1C1C1C] mb-6">Session Activity (Last 7 Days)</h2>
        {weekly.length > 0 ? (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E3DA" />
              <XAxis 
                dataKey="scheduled_date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 11, fill: '#7A7570'}} 
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#7A7570'}} />
              <Tooltip 
                cursor={{fill: '#F7F5F0'}}
                contentStyle={{borderRadius: '8px', border: '1px solid #E8E3DA', boxShadow: 'none'}}
              />
              <Bar dataKey="count" fill="#4E9A6F" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        ) : (
          <p className="text-[13px] text-[#7A7570] italic py-4 text-center">No session activity this week</p>
        )}
      </div>
    </div>
  );
}
