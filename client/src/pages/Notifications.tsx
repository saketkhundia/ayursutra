import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Settings, AlertTriangle, Calendar, Pill, Target, Info, Mail, MessageCircle, Smartphone, Trash2 } from 'lucide-react';
import { api, userAuth } from '../api';
import { useSocket } from '../hooks/useSocket';

const typeIcons: Record<string, any> = {
  'pre-procedure': AlertTriangle,
  'post-procedure': Pill,
  reminder: Calendar,
  reschedule: Calendar,
  milestone: Target,
  alert: AlertTriangle,
  custom: Info,
};

const typeColors: Record<string, string> = {
  'pre-procedure': 'bg-[#EDF4EF] text-[#4E9A6F]',
  'post-procedure': 'bg-[#EDF4EF] text-[#4E9A6F]',
  reminder: 'bg-[#F7F5F0] text-[#7A7570]',
  reschedule: 'bg-[#F7F5F0] text-[#7A7570]',
  milestone: 'bg-[#EDF4EF] text-[#4E9A6F]',
  alert: 'bg-red-50 text-red-700',
  custom: 'bg-[#F7F5F0] text-[#7A7570]',
};

const channelIcons: Record<string, any> = {
  'in-app': Bell,
  sms: MessageCircle,
  email: Mail,
  push: Smartphone,
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [channelStatus, setChannelStatus] = useState<any>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const { on } = useSocket();

  const loadNotifications = () => {
    const params: Record<string, string> = {};
    const role = userAuth.getRole();
    if (role) params.role = role;
    const user = userAuth.getUser();
    if (role === 'patient' && user?.id) params.patient_id = user.id;
    if (selectedPatient) params.patient_id = selectedPatient;
    if (filter === 'unread') params.unread_only = 'true';
    api.getNotifications(params).then(setNotifications);
  };

  useEffect(() => {
    Promise.all([
      api.getPatients(),
      api.getChannelStatus().catch(() => null),
    ]).then(([p, cs]) => {
      setPatients(p);
      setChannelStatus(cs);
    }).finally(() => setLoading(false));

    const unsub = on('notification', () => loadNotifications());
    return unsub;
  }, []);

  useEffect(() => { loadNotifications(); }, [selectedPatient, filter]);

  useEffect(() => {
    if (selectedPatient) {
      api.getNotificationPrefs(selectedPatient).then(setPrefs).catch(() => setPrefs(null));
    }
  }, [selectedPatient]);

  const handleMarkRead = async (id: string) => {
    await api.markRead(id);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      const params: Record<string, string> = {};
      const role = userAuth.getRole();
      if (role) params.role = role;
      const user = userAuth.getUser();
      if (role === 'patient' && user?.id) params.patient_id = user.id;
      if (selectedPatient) params.patient_id = selectedPatient;
      await api.markAllRead(params);
      loadNotifications();
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
      alert('Failed to mark notifications as read: ' + (err.message || 'Unknown error'));
    }
  };

  const handleClearAll = async () => {
    try {
      const params: Record<string, string> = {};
      const role = userAuth.getRole();
      if (role) params.role = role;
      const user = userAuth.getUser();
      if (role === 'patient' && user?.id) params.patient_id = user.id;
      if (selectedPatient) params.patient_id = selectedPatient;
      await api.clearNotifications(params);
      setConfirmClear(false);
      loadNotifications();
    } catch (err: any) {
      console.error('Failed to clear notifications:', err);
      alert('Failed to clear notifications: ' + (err.message || 'Unknown error'));
    }
  };

  const handleSavePrefs = async () => {
    if (!selectedPatient || !prefs) return;
    await api.updateNotificationPrefs(selectedPatient, prefs);
    setShowPrefs(false);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-[#4E9A6F] border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">Notifications</h1>
          <p className="text-[#7A7570] mt-1">Alerts and session reminders</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="inline-flex items-center gap-2 bg-[#EDF4EF] text-[#4E9A6F] px-4 py-2.5 rounded-lg hover:bg-[#EDF4EF]/80 transition-colors font-medium text-sm border border-[#C5DDD0]">
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </button>
          )}
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2.5 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm border border-red-200">
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          ) : (
            <div className="flex gap-1 items-center">
              <button onClick={handleClearAll} className="inline-flex items-center gap-1.5 bg-red-600 text-white px-3 py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium text-xs">
                Confirm
              </button>
              <button onClick={() => setConfirmClear(false)} className="inline-flex items-center gap-1.5 bg-[#F7F5F0] text-[#7A7570] px-3 py-2.5 rounded-lg hover:bg-[#E8E3DA] transition-colors font-medium text-xs border border-[#E8E3DA]">
                Cancel
              </button>
            </div>
          )}
          {selectedPatient && (
            <button onClick={() => setShowPrefs(true)} className="inline-flex items-center gap-2 bg-[#F7F5F0] text-[#1C1C1C] px-4 py-2.5 rounded-lg hover:bg-[#E8E3DA] transition-colors font-medium text-sm border border-[#E8E3DA]">
              <Settings className="w-4 h-4" /> Preferences
            </button>
          )}
        </div>
      </div>

      {channelStatus && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(channelStatus).map(([ch, status]) => {
            const ChIcon = channelIcons[ch] || Bell;
            const active = status === 'active' || status === 'simulation';
            return (
              <div key={ch} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${active ? 'bg-[#EDF4EF] text-[#4E9A6F]' : 'bg-[#F7F5F0] text-[#7A7570]'}`}>
                <ChIcon className="w-3 h-3" />
                {ch}
                <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-[#7A7570]'}`} />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        {userAuth.getRole() === 'doctor' && (
          <select
            value={selectedPatient}
            onChange={e => setSelectedPatient(e.target.value)}
            className="px-3 py-2 border border-[#E8E3DA] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4E9A6F]/40 text-sm"
          >
            <option value="">All Patients</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <div className="flex bg-[#F7F5F0] rounded-lg p-0.5 border border-[#E8E3DA]">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'all' ? 'bg-white text-[#1C1C1C] shadow-sm' : 'text-[#7A7570]'}`}
          >All</button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'unread' ? 'bg-white text-[#1C1C1C] shadow-sm' : 'text-[#7A7570]'}`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E3DA] p-12 text-center">
            <Bell className="w-12 h-12 text-[#E8E3DA] mx-auto mb-3" />
            <p className="text-[#7A7570]">No notifications to display</p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon = typeIcons[n.type] || Bell;
            const colorClass = typeColors[n.type] || 'bg-[#F7F5F0] text-[#7A7570]';

            return (
              <div key={n.id} className={`bg-white rounded-xl border p-4 transition-colors ${n.is_read ? 'border-[#E8E3DA]' : 'border-[#4E9A6F] bg-[#EDF4EF]/20'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className={`text-sm font-medium ${n.is_read ? 'text-[#5A5550]' : 'text-[#1C1C1C]'}`}>{n.title}</h4>
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${colorClass}`}>{n.type}</span>
                      </div>
                      {!n.is_read && (
                        <button onClick={() => handleMarkRead(n.id)} className="text-xs px-2 py-1 bg-[#F7F5F0] text-[#7A7570] rounded hover:bg-[#E8E3DA] flex items-center gap-1 flex-shrink-0 border border-[#E8E3DA]">
                          <Check className="w-3 h-3" /> Read
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-[#5A5550] mt-2 whitespace-pre-line leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-[#7A7570] font-medium uppercase tracking-wider">
                      {n.scheduled_for && <span>{n.scheduled_for}</span>}
                      <span className="inline-flex items-center gap-1">
                        {n.channel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showPrefs && prefs && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPrefs(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-[#1C1C1C]"><Settings className="w-5 h-5 text-[#4E9A6F]" />Preferences</h2>
            <div className="space-y-4">
              {['in_app', 'email', 'sms', 'push'].map(ch => (
                <label key={ch} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm font-medium text-[#5A5550] capitalize group-hover:text-[#1C1C1C]">{ch.replace('_', ' ')} Notifications</span>
                  <input type="checkbox" checked={!!(prefs as any)[ch]} onChange={e => setPrefs({ ...prefs, [ch]: e.target.checked ? 1 : 0 })} className="w-5 h-5 rounded accent-[#4E9A6F] cursor-pointer" />
                </label>
              ))}
              <div className="pt-2">
                <label className="block text-sm font-medium text-[#5A5550] mb-2">Reminder (hours before session)</label>
                <input type="number" min="1" max="72" value={prefs.reminder_hours_before} onChange={e => setPrefs({ ...prefs, reminder_hours_before: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-[#E8E3DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4E9A6F]/40" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowPrefs(false)} className="flex-1 px-4 py-2.5 border border-[#E8E3DA] rounded-lg hover:bg-[#F7F5F0] font-medium text-sm transition-colors text-[#5A5550]">Cancel</button>
                <button onClick={handleSavePrefs} className="flex-1 px-4 py-2.5 bg-[#4E9A6F] text-white rounded-lg hover:bg-[#4E9A6F]/90 font-medium text-sm transition-colors shadow-sm">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
