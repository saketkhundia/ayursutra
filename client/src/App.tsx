import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AyurLayout from './components/AyurLayout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Scheduling from './pages/Scheduling';
import TherapyTracking from './pages/TherapyTracking';
import Feedback from './pages/Feedback';
import Notifications from './pages/Notifications';
import LoginSelect from './pages/LoginSelect';
import DoctorAuth from './pages/DoctorAuth';
import PatientAuth from './pages/PatientAuth';
import FindDoctors from './pages/FindDoctors';
import DoctorProfile from './pages/DoctorProfile';
import DoctorDetailView from './pages/DoctorDetailView';
import DoctorAppointments from './pages/DoctorAppointments';
import PatientProgress from './pages/PatientProgress';
import Messaging from './pages/Messaging';
import { userAuth } from './api';
import './index.css';

// Smart root: redirect unauthenticated → /login, doctor → /dashboard, patient → /find-doctors
function SmartRoot() {
  if (!userAuth.isLoggedIn()) return <Navigate to="/login" replace />;
  const role = userAuth.getRole();
  return <Navigate to={role === 'patient' ? '/find-doctors' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root smart redirect */}
        <Route path="/" element={<SmartRoot />} />

        {/* Public auth pages */}
        <Route path="/login" element={<LoginSelect />} />
        <Route path="/login/doctor" element={<DoctorAuth />} />
        <Route path="/login/patient" element={<PatientAuth />} />

        {/* Protected app routes — AyurLayout handles auth guard */}
        <Route element={<AyurLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/tracking" element={<TherapyTracking />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/doctor-profile" element={<DoctorProfile />} />
          <Route path="/doctor/:id" element={<DoctorDetailView />} />
          <Route path="/doctor/appointments" element={<DoctorAppointments />} />
          <Route path="/find-doctors" element={<FindDoctors />} />
          <Route path="/my-progress" element={<PatientProgress />} />
          <Route path="/messages" element={<Messaging />} />
        </Route>

        {/* Any unknown path → smart redirect */}
        <Route path="*" element={<SmartRoot />} />
      </Routes>
    </BrowserRouter>
  );
}
