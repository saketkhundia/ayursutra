import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Settings, AlertTriangle, Calendar, Pill, Target, Info, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { api } from '../api';
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
  'pre-procedure': 'bg-amber-100 text-amber-700',
  'post-procedure': 'bg-herb-100 text-herb-700',
  reminder: 'bg-blue-100 text-blue-700',
  reschedule: 'bg-purple-100 text-purple-700',
  milestone: 'bg-saffron-100 text-saffron-700',
  alert: 'bg-red-100 text-red-700',
  custom: 'bg-stone-100 text-stone-700',
};

const channelIcons: Record<string, any> = {
  'in-app': Bell,
  sms: MessageCircle,
  email: Mail,
  push: Smartphone,
};

const channelColors: Record<string, string> = {
  'in-app': 'text-blue-600 bg-blue-50',
  sms: 'text-green-600 bg-green-50',
  email: 'text-purple-600 bg-purple-50',
  push: 'text-orange-600 bg-orange-50',
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
  const { on } = useSocket();

  const loadNotifications = () => {
    const params: Record<string, string> = {};
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
    await api.markAllRead(selectedPatient || '');
    loadNotifications();
  };

  const handleSavePrefs = async () => {
    if (!selectedPatient || !prefs) return;
    await api.updateNotificationPrefs(selectedPatient, prefs);
    setShowPrefs(false);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Notification Center</h1>
          <p className="text-stone-500 mt-1">Pre-procedure, post-procedure alerts, and session reminders</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="inline-flex items-center gap-2 bg-herb-50 text-herb-700 px-4 py-2.5 rounded-lg hover:bg-herb-100 transition-colors font-medium text-sm border border-herb-200">
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </button>
          )}
          {selectedPatient && (
            <button onClick={() => setShowPrefs(true)} className="inline-flex items-center gap-2 bg-stone-50 text-stone-700 px-4 py-2.5 rounded-lg hover:bg-stone-100 transition-colors font-medium text-sm border border-stone-200">
              <Settings className="w-4 h-4" /> Preferences
            </button>
          )}
        </div>
      </div>

      {/* Channel Status */}
      {channelStatus && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(channelStatus).map(([ch, status]) => {
            const ChIcon = channelIcons[ch] || Bell;
            const active = status === 'active' || status === 'simulation';
            return (
              <div key={ch} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${active ? channelColors[ch] || 'bg-stone-50 text-stone-600' : 'bg-stone-100 text-stone-400'}`}>
                <ChIcon className="w-3 h-3" />
                {ch}
                {status === 'simulation' && <span className="text-[9px] opacity-70">(sim)</span>}
                <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-stone-300'}`} />
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedPatient}
          onChange={e => setSelectedPatient(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500/40 text-sm"
        >
          <option value="">All Patients</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex bg-stone-100 rounded-lg p-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
          >All</button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'unread' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
            <Bell className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-400">No notifications to display</p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon = typeIcons[n.type] || Bell;
            const colorClass = typeColors[n.type] || 'bg-stone-100 text-stone-700';

            return (
              <div key={n.id} className={`bg-white rounded-xl border p-4 transition-colors ${n.is_read ? 'border-stone-100' : 'border-saffron-200 bg-saffron-50/30'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className={`text-sm font-medium ${n.is_read ? 'text-stone-700' : 'text-stone-900'}`}>{n.title}</h4>
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${colorClass}`}>{n.type}</span>
                      </div>
                      {!n.is_read && (
                        <button onClick={() => handleMarkRead(n.id)} className="text-xs px-2 py-1 bg-stone-50 text-stone-600 rounded hover:bg-stone-100 flex items-center gap-1 flex-shrink-0">
                          <Check className="w-3 h-3" /> Read
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-stone-600 mt-2 whitespace-pre-line">{n.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                      {n.scheduled_for && <span>Scheduled: {n.scheduled_for}</span>}
                      <span className="inline-flex items-center gap-1">
                        {(() => { const ChIcon = channelIcons[n.channel] || Bell; return <ChIcon className="w-3 h-3" />; })()}
                        {n.channel}
                      </span>
                      {n.delivery_status && n.delivery_status !== 'pending' && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          n.delivery_status === 'delivered' ? 'bg-herb-50 text-herb-700' :
                          n.delivery_status === 'failed' ? 'bg-red-50 text-red-700' :
                          'bg-stone-50 text-stone-500'
                        }`}>{n.delivery_status}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Notification Preferences Modal */}
      {showPrefs && prefs && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPrefs(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-stone-500" />Notification Preferences</h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">In-App Notifications</span>
                <input type="checkbox" checked={!!prefs.in_app} onChange={e => setPrefs({ ...prefs, in_app: e.target.checked ? 1 : 0 })} className="w-5 h-5 rounded accent-saffron-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Email Notifications</span>
                <input type="checkbox" checked={!!prefs.email} onChange={e => setPrefs({ ...prefs, email: e.target.checked ? 1 : 0 })} className="w-5 h-5 rounded accent-saffron-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">SMS Notifications</span>
                <input type="checkbox" checked={!!prefs.sms} onChange={e => setPrefs({ ...prefs, sms: e.target.checked ? 1 : 0 })} className="w-5 h-5 rounded accent-saffron-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Push Notifications</span>
                <input type="checkbox" checked={!!prefs.push} onChange={e => setPrefs({ ...prefs, push: e.target.checked ? 1 : 0 })} className="w-5 h-5 rounded accent-saffron-500" />
              </label>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Reminder (hours before session)</label>
                <input type="number" min="1" max="72" value={prefs.reminder_hours_before} onChange={e => setPrefs({ ...prefs, reminder_hours_before: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-stone-200 rounded-lg" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowPrefs(false)} className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg hover:bg-stone-50 font-medium text-sm">Cancel</button>
                <button onClick={handleSavePrefs} className="flex-1 px-4 py-2.5 bg-saffron-500 text-white rounded-lg hover:bg-saffron-600 font-medium text-sm">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
