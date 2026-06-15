import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, Activity,
  Bell, Leaf, Search, Mail, Clock,
  CalendarCheck, CheckCircle, XCircle, AlertCircle, X,
} from 'lucide-react';
import { api, userAuth } from '../api';
import { useSocket } from '../hooks/useSocket';
import AyurNavbar from './AyurNavbar';

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Clinic overview & insights' },
  '/patients': { title: 'Patients', subtitle: 'Manage your patient roster' },
  '/scheduling': { title: 'Scheduling', subtitle: 'Therapy sessions & calendar' },
  '/tracking': { title: 'Therapy Tracking', subtitle: 'Plans & progress tracking' },
  '/feedback': { title: 'Feedback', subtitle: 'Patient ratings & comments' },
  '/notifications': { title: 'Notifications', subtitle: 'Alerts & updates' },
  '/doctor-profile': { title: 'My Profile', subtitle: 'Public profile & practice details' },
  '/doctor/appointments': { title: 'Appointments', subtitle: 'Incoming appointment requests' },
  '/find-doctors': { title: 'Find Practitioners', subtitle: 'Browse Ayurvedic specialists' },
  '/my-progress': { title: 'My Therapy Progress', subtitle: 'Your wellness journey, tracked' },
  '/messages': { title: 'Messages', subtitle: 'Secure chat with your care team' },
};

function getPageMeta(pathname: string): { title: string; subtitle?: string } {
  if (pathname.startsWith('/patients/') && pathname !== '/patients') {
    return { title: 'Patient', subtitle: 'Care plan & sessions' };
  }
  return PAGE_META[pathname] ?? { title: 'AyurSutra' };
}

const doctorNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/doctor/appointments', icon: Clock, label: 'Appointments' },
  { to: '/scheduling', icon: Calendar, label: 'Scheduling' },
  { to: '/tracking', icon: Activity, label: 'Therapy' },
  { to: '/messages', icon: Mail, label: 'Messages' },
];

const patientNavItems = [
  { to: '/find-doctors', icon: Search, label: 'Find Doctors' },
  { to: '/my-progress', icon: Activity, label: 'My Therapy Progress' },
  { to: '/messages', icon: Mail, label: 'Messages' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
];

export default function AyurLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastNotif, setToastNotif] = useState<{ title: string; message: string } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [loginPopup, setLoginPopup] = useState<any[]>([]);
  const [popupVisible, setPopupVisible] = useState(false);
  const popupShownRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { on, joinDashboard, joinPatientChannel } = useSocket();

  const role = userAuth.getRole();
  const user = userAuth.getUser();
  const pageMeta = getPageMeta(location.pathname);

  const lastNotificationIdRef = useRef<string | null>(null);
  const isFirstLoadRef = useRef<boolean>(true);

  // All hooks must be called before any early return
  useEffect(() => {
    if (!user?.id) return;
    if (role === 'doctor') {
      joinDashboard();
    } else if (role === 'patient') {
      joinPatientChannel(user.id);
    }
  }, [role, user?.id]);

  useEffect(() => {
    const refresh = () => {
      const params: Record<string, string> = {};
      if (role) params.role = role;
      if (role === 'patient' && user?.id) params.patient_id = user.id;
      api.getUnreadCount(params).then(data => setUnreadCount(data.count)).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 6000);
    const unsub = on('notification', refresh);
    const unsubNew = on('notification:new', refresh);
    window.addEventListener('notifications:updated', refresh);
    return () => { 
      clearInterval(interval); 
      unsub(); 
      unsubNew();
      window.removeEventListener('notifications:updated', refresh); 
    };
  }, [role, user?.id]);

  useEffect(() => {
    const unsub = on('notification:new', (data: any) => {
      if (!data?.title) return;
      if (role === 'doctor' && data.patient_id !== '') return;
      setToastNotif({ title: data.title, message: data.message || '' });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 6000);
    });

    if (!user?.id) return unsub;

    const params: Record<string, string> = {};
    if (role) params.role = role;
    if (role === 'patient' && user?.id) params.patient_id = user.id;

    const checkNewNotifications = () => {
      api.getNotifications(params).then(notifications => {
        if (!notifications || notifications.length === 0) {
          isFirstLoadRef.current = false;
          return;
        }
        
        const newest = notifications[0];
        
        if (isFirstLoadRef.current) {
          lastNotificationIdRef.current = newest.id;
          isFirstLoadRef.current = false;
          return;
        }

        if (newest.id !== lastNotificationIdRef.current) {
          const lastIdx = notifications.findIndex((n: any) => n.id === lastNotificationIdRef.current);
          const newNotifications = lastIdx !== -1 ? notifications.slice(0, lastIdx) : [newest];
          
          if (newNotifications.length > 0) {
            const notifToShow = newNotifications[0];
            if (notifToShow.title) {
              if (!(role === 'doctor' && notifToShow.patient_id !== '')) {
                setToastNotif({ title: notifToShow.title, message: notifToShow.message || '' });
                setShowToast(true);
                setTimeout(() => setShowToast(false), 6000);
              }
            }
          }
          lastNotificationIdRef.current = newest.id;
        }
      }).catch(err => console.error('[AyurLayout] Error polling new notifications for toast:', err));
    };

    const pollInterval = setInterval(checkNewNotifications, 5000);

    return () => {
      unsub();
      clearInterval(pollInterval);
    };
  }, [role, user?.id]);

  useEffect(() => {
    if (role !== 'patient' || !user?.id || popupShownRef.current) return;
    popupShownRef.current = true;

    const loadRecentAppointments = async () => {
      try {
        const appointments = await api.getAppointments({ patient_id: user.id });
        if (!appointments || !Array.isArray(appointments)) return;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = appointments.filter((apt: any) => {
          const created = new Date(apt.updated_at || apt.created_at);
          return created >= sevenDaysAgo && ['accepted', 'pending', 'rejected'].includes(apt.status);
        }).slice(0, 5);

        if (recent.length > 0) {
          setLoginPopup(recent);
          setPopupVisible(true);
          setTimeout(() => setPopupVisible(false), 10000);
        }
      } catch (err) {
        console.error('[AyurLayout] Failed to load notifications:', err);
      }
    };

    setTimeout(loadRecentAppointments, 800);
  }, [role, user?.id]);

  // Auth guard — redirect to login if not authenticated
  if (!userAuth.isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  // Role guard
  const doctorOnlyPaths = ['/dashboard', '/patients', '/scheduling', '/tracking', '/feedback', '/doctor-profile', '/doctor/appointments'];
  if (role === 'patient' && doctorOnlyPaths.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/find-doctors" replace />;
  }

  const patientOnlyPaths = ['/my-progress'];
  if (role === 'doctor' && patientOnlyPaths.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/dashboard" replace />;
  }

  const navItems = role === 'patient' ? patientNavItems : doctorNavItems;

  const handleLogout = () => {
    userAuth.clear();
    navigate('/login', { replace: true });
  };

  const getPopupIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending': return <Clock className="w-5 h-5 text-amber-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <AyurNavbar navItems={navItems} unreadCount={unreadCount} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0 pt-[56px]">
        <header className="border-b px-6 py-3 flex items-center gap-3 sticky top-[56px] z-30" style={{ backgroundColor: 'var(--bg-header)', borderColor: 'var(--border-color)' }}>
          <div className="hidden lg:flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Leaf className="w-4 h-4 text-[#4E9A6F]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest">{role === 'patient' ? 'Patient Portal' : 'Practitioner Console'}</span>
          </div>
          <div className="flex-1 min-w-0 lg:text-center">
            <h1 className="text-lg font-semibold truncate leading-tight lg:text-xl" style={{ color: 'var(--text-primary)' }}>{pageMeta.title}</h1>
          </div>
          <div className="flex-1 min-w-0 hidden lg:block" />
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `relative p-2 rounded-lg transition-colors ${isActive ? 'bg-[#EDF4EF] text-[#4E9A6F]' : 'hover:bg-[#F7F5F0]'}`
            }
            style={{ color: 'var(--text-muted)' }}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#4E9A6F] text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          <div className="max-w-[1280px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {showToast && toastNotif && (
        <div className="fixed top-4 right-4 z-[70] w-80">
          <div className="bg-white rounded-xl shadow-lg border border-[#E8E3DA] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#4E9A6F]">
              <Bell className="w-4 h-4 text-white" />
              <p className="text-sm font-semibold text-white flex-1 truncate">{toastNotif.title}</p>
              <button onClick={() => setShowToast(false)} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-4 py-3 text-sm text-[#5A5550] bg-[#F7F5F0]/50">{toastNotif.message}</div>
          </div>
        </div>
      )}

      {popupVisible && loginPopup.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[60] w-96 max-w-[calc(100vw-2rem)]">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E8E3DA] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#4E9A6F] text-white">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5" />
                <span className="text-sm font-bold">Updates</span>
              </div>
              <button onClick={() => setPopupVisible(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-[#E8E3DA]">
              {loginPopup.map((apt: any, idx: number) => (
                <div key={idx} className="p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate('/notifications')}>
                  {getPopupIcon(apt.status)}
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Appointment update from Dr. {apt.doctor_name || 'Practitioner'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
