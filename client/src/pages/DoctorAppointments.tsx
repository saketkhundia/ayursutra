import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, MessageSquare, AlertCircle, Loader2, Trash2 } from 'lucide-react';
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
  const socket = useSocket();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const currentUser = userAuth.getUser();
  const doctorId = currentUser?.id;

  // Fetch appointments on mount and when tab changes
  useEffect(() => {
    if (!doctorId) {
      setError('Doctor profile not found. Please login.');
      setLoading(false);
      return;
    }

    fetchAppointments();
  }, [doctorId]);

  // Listen for real-time appointment updates
  useEffect(() => {
    if (!socket) return;

    const unsubscribe = socket.on('appointment:request', (data: any) => {
      console.log('New appointment request:', data);
      // Add to pending list and notify
      const newAppointment: Appointment = {
        id: data.appointment_id,
        patient_id: data.patient_id,
        patient_name: data.patient_name,
        patient_email: data.patient_email,
        therapy_type: data.therapy_type,
        preferred_date: data.preferred_date,
        preferred_time: data.preferred_time,
        reason_for_visit: data.reason_for_visit,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setAppointments(prev => [newAppointment, ...prev]);
    });

    return unsubscribe;
  }, [socket]);

  const fetchAppointments = async () => {
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
      try {
        const pendingAppointments = await api.getPendingAppointmentRequests(doctorId);
        setAppointments(pendingAppointments);
        setError('Could not load all appointments. Showing pending requests only.');
      } catch (fallbackErr) {
        console.error('Failed to fetch pending appointments:', fallbackErr);
        setAppointments([]);
        setError(err.message || 'Failed to load appointments');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (appointment: Appointment) => {
    setIsProcessing(true);
    try {
      await api.acceptAppointment(appointment.id, 'Appointment accepted');
      // Update local state
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === appointment.id ? { ...apt, status: 'accepted' } : apt
        )
      );
      setSelectedAppointment(null);
    } catch (err: any) {
      console.error('Error accepting appointment:', err);
      alert('Failed to accept appointment: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAppointment || !rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setIsProcessing(true);
    try {
      await api.rejectAppointmentRequest(selectedAppointment.id, rejectReason, true);
      // Update local state
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === selectedAppointment.id
            ? { ...apt, status: 'rejected', rejection_reason: rejectReason }
            : apt
        )
      );
      setShowRejectModal(false);
      setSelectedAppointment(null);
      setRejectReason('');
    } catch (err: any) {
      console.error('Error rejecting appointment:', err);
      alert('Failed to reject appointment: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendApology = (appointment: Appointment) => {
    // Navigate to messaging with patient pre-selected
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
    { pending: 0, accepted: 0, rejected: 0 } as Record<Appointment['status'], number>
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
            {(['pending', 'accepted', 'rejected'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 font-semibold border-b-2 transition ${
                  activeTab === tab
                    ? 'border-saffron-500 text-saffron-600'
                    : 'border-transparent text-stone-600 hover:text-stone-800'
                }`}
              >
                {tab === 'pending' && '⏳ Pending'}
                {tab === 'accepted' && '✓ Accepted'}
                {tab === 'rejected' && '✗ Rejected'}
                <span className="ml-2 text-sm bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full inline-block">
                  {appointmentCounts[tab]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Appointments List */}
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-600 font-semibold text-lg">
              {activeTab === 'pending' && 'No pending appointments'}
              {activeTab === 'accepted' && 'No accepted appointments'}
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
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        appointment.status === 'pending'
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          : appointment.status === 'accepted'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {appointment.status === 'pending' && '⏳ Pending'}
                      {appointment.status === 'accepted' && '✓ Accepted'}
                      {appointment.status === 'rejected' && '✗ Rejected'}
                    </span>
                  </div>

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
                  {appointment.status === 'pending' && (
                    <div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(appointment)}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold py-2 px-3 rounded-lg transition text-sm"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Accept
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setShowRejectModal(true);
                          }}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold py-2 px-3 rounded-lg transition text-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

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
                    <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-center">
                      <p className="text-sm text-emerald-700 font-semibold">
                        ✓ Appointment confirmed. Therapy session has been scheduled.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-stone-800 mb-4">Reject Appointment</h2>
            <p className="text-stone-600 mb-4">
              Provide a reason for rejection. This will be sent to the patient as an apology message.
            </p>

            <textarea
              placeholder='e.g., "I am fully booked at this time", "I am not available on that date"'
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none h-24 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 font-semibold rounded-lg hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing || !rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-lg transition disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Reject & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
