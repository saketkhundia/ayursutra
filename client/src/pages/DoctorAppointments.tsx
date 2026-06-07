import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
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
  const [showAiSchedule, setShowAiSchedule] = useState(false);
  const [aiScheduleAppointment, setAiScheduleAppointment] = useState<Appointment | null>(null);
  const [recommendedTherapies, setRecommendedTherapies] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState('');

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
    try {
      setLoading(true);
      setError('');
      const data = await api.getAppointments({ doctor_id: doctorId });
      setAppointments(data);
    } catch (err: any) {
      console.error('Failed to fetch appointments:', err);
      setError('Failed to load appointments');
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

  const handleOpenAiSchedule = async (appointment: Appointment) => {
    setAiScheduleAppointment(appointment);
    setShowAiSchedule(true);
    setLoadingRecommendations(true);
    setRecommendationError('');
    
    try {
      console.log('🔍 Requesting recommendations for:', {
        appointmentId: appointment.id,
        patientId: appointment.patient_id,
        therapyType: appointment.therapy_type,
      });

      // Get recommended therapies for this appointment
      const recommendations = await api.recommendTherapiesForAppointment(
        appointment.id,
        appointment.patient_id,
        appointment.therapy_type || 'General'
      );

      console.log('✅ Recommendations received:', recommendations);
      setRecommendedTherapies(recommendations.recommendations || []);
    } catch (err: any) {
      console.error('❌ Error loading recommendations:', err);
      
      // Extract detailed error message
      let errorMsg = err.message || 'Failed to load recommendations';
      const details = err.details;
      
      // If API provided available therapies in debug info, include them
      if (details?.debug?.available) {
        errorMsg += `\n\nAvailable therapies: ${details.debug.available.join(', ')}`;
        console.log('Debug info:', details.debug);
      }
      
      setRecommendationError(errorMsg);
      setRecommendedTherapies([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

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
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Appointment Requests</h1>
          <p className="text-saffron-100">Manage and respond to patient appointment requests</p>
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
                  {filteredAppointments.length}
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
                    <div className="space-y-2">
                      <button
                        onClick={() => handleOpenAiSchedule(appointment)}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-3 rounded-lg transition text-sm"
                      >
                        🧠 AI Smart Schedule
                      </button>
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

      {/* AI Smart Schedule Modal */}
      {showAiSchedule && aiScheduleAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                <span>🧠 AI Smart Schedule</span>
              </h2>
              <button
                onClick={() => {
                  setShowAiSchedule(false);
                  setAiScheduleAppointment(null);
                  setRecommendedTherapies([]);
                  setRecommendationError('');
                }}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            {/* Appointment Details */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-indigo-600 font-semibold mb-1">PATIENT</p>
                  <p className="text-sm font-bold text-stone-800">{aiScheduleAppointment.patient_name}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600 font-semibold mb-1">REQUESTED THERAPY</p>
                  <p className="text-sm font-bold text-stone-800">{aiScheduleAppointment.therapy_type}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600 font-semibold mb-1">PREFERRED DATE</p>
                  <p className="text-sm font-bold text-stone-800">{aiScheduleAppointment.preferred_date}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600 font-semibold mb-1">PREFERRED TIME</p>
                  <p className="text-sm font-bold text-stone-800">{aiScheduleAppointment.preferred_time}</p>
                </div>
              </div>
              {aiScheduleAppointment.reason_for_visit && (
                <div className="mt-4 pt-4 border-t border-indigo-200">
                  <p className="text-xs text-indigo-600 font-semibold mb-1">PATIENT'S REASON</p>
                  <p className="text-sm text-stone-700">{aiScheduleAppointment.reason_for_visit}</p>
                </div>
              )}
            </div>

            {/* Recommended Therapies */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-stone-800 mb-3">AI-Recommended Complementary Therapies</h3>
              
              {recommendationError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm font-semibold mb-2">⚠️ Error loading recommendations:</p>
                  <p className="text-red-600 text-sm whitespace-pre-wrap">{recommendationError}</p>
                </div>
              )}
              
              {loadingRecommendations ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
                </div>
              ) : recommendedTherapies.length === 0 ? (
                <p className="text-stone-500 text-sm py-4">{recommendationError ? 'No recommendations available due to the error above.' : 'No recommendations available yet.'}</p>
              ) : (
                <div className="space-y-3">
                  {recommendedTherapies.map((therapy, idx) => (
                    <div key={idx} className="border border-stone-200 rounded-lg p-4 hover:bg-stone-50 transition">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-stone-800">{therapy.name}</p>
                          <p className="text-xs text-stone-500 mt-1">{therapy.category} • {therapy.duration_minutes} min</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-indigo-600">{therapy.score}</p>
                          <p className="text-xs text-indigo-500">score</p>
                        </div>
                      </div>
                      <p className="text-sm text-stone-600 bg-stone-50 rounded px-2 py-1">
                        ✓ {therapy.reason}
                      </p>
                      {therapy.type && (
                        <p className="text-xs mt-2 text-stone-500">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-stone-100 mr-1">
                            {therapy.type.replace('-', ' ').toUpperCase()}
                          </span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAiSchedule(false);
                  setAiScheduleAppointment(null);
                  setRecommendationError('');
                }}
                className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 font-semibold rounded-lg hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Navigate to Scheduling page with appointment data
                  navigate('/scheduling', { state: { appointmentId: aiScheduleAppointment.id, patientId: aiScheduleAppointment.patient_id, therapyType: aiScheduleAppointment.therapy_type } });
                  setShowAiSchedule(false);
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
              >
                Go to Scheduling & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
