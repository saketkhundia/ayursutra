import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, MessageSquare, AlertCircle, Loader2, Trash2, Sparkles } from 'lucide-react';
import { api, userAuth } from '../api';
import { useSocket } from '../hooks/useSocket';

interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_email: string;
  therapy_type: string;
  preferred_date: string;
  preferred_time: string;
  reason_for_visit: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
}

export default function DoctorAppointments() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket, on } = useSocket();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'accepted' | 'rejected'>('accepted');
  const [confirmClear, setConfirmClear] = useState(false);

  const currentUser = userAuth.getUser();
  const doctorId = currentUser?.id;

  const fetchAppointments = useCallback(async () => {
    if (!doctorId) {
      setError('Doctor profile not found. Please login.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const data = await api.getAppointments({ doctor_id: doctorId });
      setAppointments(data);
    } catch (err: any) {
      console.error('Failed to fetch appointments:', err);
      setAppointments([]);
      setError(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  // Fetch appointments on mount, navigation, and doctorId changes
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments, location.pathname]);

  // Listen for real-time new appointments
  useEffect(() => {
    if (!socket) return;

    const handleRequest = (data: any) => {
      fetchAppointments();
    };

    const handleConnect = () => fetchAppointments();

    socket.on('appointment:request', handleRequest);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('appointment:request', handleRequest);
      socket.off('connect', handleConnect);
    };
  }, [socket, fetchAppointments]);

  const handleSendApology = (appointment: Appointment) => {
    navigate(`/messages?patient=${appointment.patient_id}`);
  };

  const handleClearHistory = async () => {
    try {
      const res = await api.clearAppointments({ doctor_id: doctorId });
      setAppointments([]);
      setConfirmClear(false);
      alert(res.message || 'Appointment history cleared');
    } catch (err: any) {
      console.error('Error clearing history:', err);
      alert('Failed to clear history: ' + (err.message || 'Unknown error'));
    }
  };

  const appointmentCounts = appointments.reduce(
    (counts, apt) => ({
      ...counts,
      [apt.status]: (counts[apt.status] || 0) + 1,
    }),
    { accepted: 0, rejected: 0 } as Record<string, number>
  );
  const filteredAppointments = appointments.filter(apt => apt.status === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-saffron-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-saffron-500 to-saffron-600 text-white py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Appointment Requests</h1>
            <p className="text-saffron-100">Manage and respond to patient appointment requests</p>
          </div>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors text-sm font-medium self-start sm:self-auto">
              <Trash2 className="w-4 h-4" /> Clear History
            </button>
          ) : (
            <div className="flex gap-2 items-center self-start sm:self-auto">
              <button onClick={handleClearHistory} className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors text-xs font-medium">
                Confirm Clear
              </button>
              <button onClick={() => setConfirmClear(false)} className="bg-white/10 text-white px-3 py-2 rounded-lg hover:bg-white/20 transition-colors text-xs font-medium">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-stone-200">
          <div className="flex gap-8">
            {(['accepted', 'rejected'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 font-semibold border-b-2 transition ${
                  activeTab === tab
                    ? 'border-saffron-500 text-saffron-600'
                    : 'border-transparent text-stone-600 hover:text-stone-800'
                }`}
              >
                {tab === 'accepted' && '✓ Confirmed'}
                {tab === 'rejected' && '✗ Rejected'}
                <span className="ml-2 text-sm bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full inline-block">
                  {appointmentCounts[tab] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Info banner */}
        {activeTab === 'accepted' && (
          <div className="mb-6 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            Appointments are automatically approved when the time slot is available. No manual review needed.
          </div>
        )}

        {/* Appointments List */}
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-600 font-semibold text-lg">
              {activeTab === 'accepted' && 'No confirmed appointments'}
              {activeTab === 'rejected' && 'No rejected appointments'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredAppointments.map(appointment => (
              <div
                key={appointment.id}
                className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-lg transition overflow-hidden"
              >
                <div className="p-6">
                  {/* Header with status */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-stone-800">{appointment.patient_name}</h3>
                      <p className="text-sm text-stone-600">{appointment.patient_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {appointment.auto_approved && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                          ✨ Auto-Approved
                        </span>
                      )}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          appointment.status === 'accepted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {appointment.status === 'accepted' && '✓ Confirmed'}
                        {appointment.status === 'rejected' && '✗ Not Available'}
                      </span>
                    </div>
                  </div>
                  {appointment.ai_decision_reason && (
                    <p className="text-[10px] text-stone-400 italic mb-3 leading-tight bg-stone-50 rounded px-2 py-1.5">
                      AI: {appointment.ai_decision_reason}
                    </p>
                  )}

                  {/* Details */}
                  <div className="space-y-3 mb-6 pb-6 border-b border-stone-100">
                    <div>
                      <p className="text-xs text-stone-600 font-semibold mb-1">THERAPY TYPE</p>
                      <p className="text-sm font-semibold text-stone-800">{appointment.therapy_type}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-stone-600 font-semibold mb-1">DATE</p>
                        <p className="text-sm font-semibold text-stone-800">{appointment.preferred_date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-600 font-semibold mb-1">TIME</p>
                        <p className="text-sm font-semibold text-stone-800">{appointment.preferred_time}</p>
                      </div>
                    </div>

                    {appointment.reason_for_visit && (
                      <div>
                        <p className="text-xs text-stone-600 font-semibold mb-1">REASON</p>
                        <p className="text-sm text-stone-700 line-clamp-2">{appointment.reason_for_visit}</p>
                      </div>
                    )}

                    {appointment.rejection_reason && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <p className="text-xs text-red-700 font-semibold mb-1">REJECTION REASON</p>
                        <p className="text-sm text-red-700">{appointment.rejection_reason}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {appointment.status === 'rejected' && (
                    <button
                      onClick={() => handleSendApology(appointment)}
                      className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg transition text-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Send Message to Patient
                    </button>
                  )}

                  {appointment.status === 'accepted' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">
                            ✓ Confirmed — Session Scheduled
                          </p>
                          <p className="text-xs text-emerald-600 mt-0.5">
                            {appointment.preferred_date} at {appointment.preferred_time}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
