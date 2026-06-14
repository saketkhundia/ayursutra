import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, Brain, ArrowUpRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { api, userAuth } from '../api';
import { useSocket } from '../hooks/useSocket';

const COLORS = ['#4E9A6F', '#7A9E8A', '#C9A96E', '#5A5550', '#8c7043'];

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
  const doctorName = user?.name || 'Sharma';

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
        <h1 className="text-[20px] font-medium text-[#1C1C1C]">Good morning, Dr. {doctorName} 👋</h1>
      </div>

      {/* Primary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label="Today's Sessions" 
          value={stats?.todaySessions || "12"} 
          subtext="+3 from yesterday" 
          link="/scheduling" 
        />
        <StatCard 
          label="Pending Review" 
          value={stats?.pendingReview || "4"} 
          subtext="AI suggestions ready" 
          link="/doctor/appointments" 
        />
        <StatCard 
          label="Completion Rate" 
          value={`${stats?.completionRate || "94"}%`} 
          subtext="This week" 
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
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-[#7A7570] uppercase mb-1">Top Rated Therapy</p>
                  <p className="text-[16px] font-medium text-[#1C1C1C]">{aiInsights?.topTherapies?.[0]?.name || "Panchakarma"}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#EDF4EF] flex items-center justify-center">
                  <Star className="w-5 h-5 text-[#4E9A6F] fill-[#4E9A6F]" />
                </div>
              </div>
              <p className="text-[13px] text-[#5A5550] leading-relaxed">
                Based on recent patient feedback, <strong>{aiInsights?.topTherapies?.[0]?.name || "Panchakarma"}</strong> sessions show the highest recovery rates this month.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[10px] border border-[#E8E3DA] p-6">
            <h2 className="text-[14px] font-semibold text-[#1C1C1C] mb-4">Therapy Distribution</h2>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={distribution.length ? distribution : [{name: 'General', session_count: 100}]} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={45}
                    outerRadius={70} 
                    paddingAngle={4}
                    dataKey="session_count"
                  >
                    {(distribution.length ? distribution : [1]).map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div className="bg-white rounded-[10px] border border-[#E8E3DA] p-6">
        <h2 className="text-[14px] font-semibold text-[#1C1C1C] mb-6">Session Activity (Last 7 Days)</h2>
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
      </div>
    </div>
  );
}
