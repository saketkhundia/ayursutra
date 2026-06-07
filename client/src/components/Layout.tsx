import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, Activity, MessageSquare,
  Bell, Menu, X, Leaf, Search, UserCircle, LogOut, ShieldCheck, Mail, Clock,
  CalendarCheck, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';
import { api, userAuth } from '../api';
import { useSocket } from '../hooks/useSocket';

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview & insights' },
  '/patients': { title: 'Patients', subtitle: 'Your patient list' },
  '/scheduling': { title: 'Scheduling', subtitle: 'Appointments & calendar' },
  '/tracking': { title: 'Therapy tracking', subtitle: 'Plans & progress' },
  '/feedback': { title: 'Feedback', subtitle: 'Ratings & comments' },
  '/notifications': { title: 'Notifications', subtitle: 'Alerts & updates' },
  '/doctor-profile': { title: 'My profile', subtitle: 'Public profile & settings' },
  '/doctor/appointments': { title: 'Appointments', subtitle: 'Appointment requests' },
  '/find-doctors': { title: 'Find doctors', subtitle: 'Browse practitioners' },
  '/my-progress': { title: 'My Therapy Progress', subtitle: 'Plans & sessions (synced with your care team)' },
  '/messages': { title: 'Messages', subtitle: 'Chat with your care team' },
};

function getPageMeta(pathname: string): { title: string; subtitle?: string } {
  if (pathname.startsWith('/patients/') && pathname !== '/patients') {
    return { title: 'Patient', subtitle: 'Care plan & sessions' };
  }
  return PAGE_META[pathname] ?? { title: 'ATASS' };
}

const doctorNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/doctor/appointments', icon: Clock, label: 'Appointments' },
  { to: '/scheduling', icon: Calendar, label: 'Scheduling' },
  { to: '/tracking', icon: Activity, label: 'Therapy Tracking' },
  { to: '/feedback', icon: MessageSquare, label: 'Feedback' },
  { to: '/messages', icon: Mail, label: 'Messages' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/doctor-profile', icon: UserCircle, label: 'My Profile' },
];

const patientNavItems = [
  { to: '/find-doctors', icon: Search, label: 'Find Doctors' },
  { to: '/my-progress', icon: Activity, label: 'My Therapy Progress' },
  { to: '/messages', icon: Mail, label: 'Messages' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loginPopup, setLoginPopup] = useState<any[]>([]);
  const [popupVisible, setPopupVisible] = useState(false);
  const popupShownRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { on } = useSocket();

  const role = userAuth.getRole();
  const user = userAuth.getUser();
  const pageMeta = getPageMeta(location.pathname);

  // Auth guard — redirect to login if not authenticated
  if (!userAuth.isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  // Role guard — patients cannot access doctor-only pages
  const doctorOnlyPaths = ['/dashboard', '/patients', '/scheduling', '/tracking', '/feedback', '/doctor-profile', '/doctor/appointments'];
  if (role === 'patient' && doctorOnlyPaths.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/find-doctors" replace />;
  }

  const patientOnlyPaths = ['/my-progress'];
  if (role === 'doctor' && patientOnlyPaths.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/dashboard" replace />;
  }

  const navItems = role === 'patient' ? patientNavItems : doctorNavItems;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    const refresh = () => api.getUnreadCount().then(data => setUnreadCount(data.count)).catch(() => {});
    refresh();
    const interval = setInterval(refresh, 30000);
    const unsub = on('notification', refresh);
    return () => { clearInterval(interval); unsub(); };
  }, []);

  // Patient login notification popup
  useEffect(() => {
    if (role !== 'patient' || !user?.id || popupShownRef.current) return;
    popupShownRef.current = true;

    const loadRecentAppointments = async () => {
      try {
        const appointments = await api.getAppointments({ patient_id: user.id });
        if (!appointments || !Array.isArray(appointments)) return;

        // Filter to recent (last 7 days) and relevant statuses
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = appointments.filter((apt: any) => {
          const created = new Date(apt.updated_at || apt.created_at);
          return created >= sevenDaysAgo && ['accepted', 'pending', 'rejected'].includes(apt.status);
        }).slice(0, 5); // Max 5 items

        if (recent.length > 0) {
          setLoginPopup(recent);
          setPopupVisible(true);
          // Auto-dismiss after 10s
          setTimeout(() => setPopupVisible(false), 10000);
        }
      } catch (err) {
        console.error('[Layout] Failed to load appointment notifications:', err);
      }
    };

    // Small delay so the page renders first
    const timer = setTimeout(loadRecentAppointments, 800);
    return () => clearTimeout(timer);
  }, [role, user?.id]);

  const getPopupIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
      case 'pending': return <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />;
      default: return <AlertCircle className="w-5 h-5 text-stone-400 flex-shrink-0" />;
    }
  };

  const getPopupMessage = (apt: any) => {
    const doctorName = apt.doctor_name || 'your doctor';
    const therapy = apt.therapy_type || 'therapy';
    const date = apt.preferred_date || '';
    const time = apt.preferred_time || '';
    switch (apt.status) {
      case 'accepted':
        return `Dr. ${doctorName} confirmed your ${therapy} appointment${date ? ` on ${date}` : ''}${time ? ` at ${time}` : ''}`;
      case 'pending':
        return `Your appointment request with Dr. ${doctorName} for ${therapy} is pending review`;
      case 'rejected':
        return `Dr. ${doctorName} couldn't accommodate your ${therapy} request — check messages for details`;
      default:
        return `Appointment update from Dr. ${doctorName}`;
    }
  };

  const getPopupBg = (status: string) => {
    switch (status) {
      case 'accepted': return 'border-l-emerald-500 bg-emerald-50/80';
      case 'rejected': return 'border-l-red-500 bg-red-50/80';
      case 'pending': return 'border-l-amber-500 bg-amber-50/80';
      default: return 'border-l-stone-400 bg-stone-50/80';
    }
  };

  const handleLogout = () => {
    userAuth.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        id="app-sidebar"
        className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-earth-900 to-earth-950
        text-white transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        flex flex-col shadow-xl lg:shadow-none
      `}
      >
        <div className="p-5 border-b border-earth-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saffron-500 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-saffron-300">ATASS</h1>
              <p className="text-xs text-earth-300">{role === 'patient' ? 'Patient Portal' : 'AI Therapy & Scheduling'}</p>
            </div>
          </div>
        </div>

        {/* Logged-in user info */}
        {user && (
          <div className="px-4 py-3 border-b border-earth-700 bg-earth-800/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-saffron-600/30 flex items-center justify-center flex-shrink-0">
                <span className="text-saffron-300 text-sm font-bold">{user.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-earth-400 truncate flex items-center gap-1">
                  {role === 'doctor' ? (
                    <>
                      {user.verified && <ShieldCheck className="w-3 h-3 text-emerald-400" />}
                      {user.specialization || 'Doctor'}
                    </>
                  ) : 'Patient'}
                </p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/find-doctors'}
              className={({ isActive }) => `
                flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-4
                ${isActive
                  ? 'bg-saffron-600/20 text-saffron-300 border-saffron-400'
                  : 'text-earth-200 hover:bg-earth-800 hover:text-white border-transparent'
                }
              `}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
              {item.to === '/notifications' && unreadCount > 0 && (
                <span className="ml-auto bg-saffron-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-earth-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-earth-300 hover:bg-red-900/30 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
          <p className="text-xs text-earth-500 text-center mt-2">v2.0.0 &middot; Ayurveda Wellness</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-stone-200/80 px-4 py-3 flex items-center gap-3 sticky top-0 z-30 supports-[backdrop-filter]:bg-white/80">
          <button
            type="button"
            onClick={() => setSidebarOpen(o => !o)}
            className="lg:hidden p-2 rounded-lg hover:bg-stone-100 text-stone-700 -ml-1"
            aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0 lg:hidden">
            <h1 className="text-lg font-semibold text-stone-900 truncate leading-tight">{pageMeta.title}</h1>
            {pageMeta.subtitle && (
              <p className="text-xs text-stone-500 truncate mt-0.5">{pageMeta.subtitle}</p>
            )}
          </div>
          <div className="flex-1 min-w-0 hidden lg:block" />
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `relative p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400 focus-visible:ring-offset-2 ${
                isActive ? 'bg-saffron-50 text-saffron-700' : 'hover:bg-stone-100 text-stone-600'
              }`
            }
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-saffron-500 text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center tabular-nums">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="max-w-[1600px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Patient Login Notification Popup */}
      {popupVisible && loginPopup.length > 0 && (
        <div
          className="fixed bottom-6 right-6 z-[60] w-96 max-w-[calc(100vw-2rem)] animate-[slideUp_0.4s_ease-out]"
          style={{ animation: 'slideUp 0.4s ease-out' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            {/* Popup Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-saffron-500 to-saffron-600">
              <div className="flex items-center gap-2 text-white">
                <CalendarCheck className="w-5 h-5" />
                <span className="text-sm font-bold">Appointment Updates</span>
                <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{loginPopup.length}</span>
              </div>
              <button
                onClick={() => setPopupVisible(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Popup Items */}
            <div className="max-h-72 overflow-y-auto divide-y divide-stone-100">
              {loginPopup.map((apt: any, idx: number) => (
                <button
                  key={apt.id || idx}
                  onClick={() => {
                    setPopupVisible(false);
                    navigate(apt.status === 'rejected' ? '/messages' : '/my-progress');
                  }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 border-l-4 hover:bg-stone-50/50 transition-colors ${getPopupBg(apt.status)}`}
                >
                  {getPopupIcon(apt.status)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-800 leading-snug">{getPopupMessage(apt)}</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {apt.status === 'accepted' ? '✅ Confirmed' : apt.status === 'pending' ? '⏳ Awaiting review' : '❌ Not available'}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Popup Footer */}
            <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100">
              <button
                onClick={() => {
                  setPopupVisible(false);
                  navigate('/notifications');
                }}
                className="text-xs font-semibold text-saffron-600 hover:text-saffron-700 transition-colors"
              >
                View all notifications →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
