import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, BookOpen, Clock, ShieldCheck, Mail, Send, Calendar, X, AlertCircle, Info } from 'lucide-react';
import { api, userAuth } from '../api';

export default function DoctorDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [therapies, setTherapies] = useState<any[]>([]);
  const [therapiesLoading, setTherapiesLoading] = useState(false);
  const [bookingData, setBookingData] = useState({
    preferred_date: '',
    preferred_time: '',
    reason_for_visit: '',
    therapy_type: '',
    duration_minutes: 60,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [weeklyAvailability, setWeeklyAvailability] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsChecked, setSlotsChecked] = useState(false);

  const currentUser = userAuth.getUser();

  const handleMessage = () => {
    if (doctor?.id) {
      navigate(`/messages?doctor=${doctor.id}`);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    setIsSubmitting(true);

    try {
      if (!bookingData.preferred_date || !bookingData.preferred_time || !bookingData.therapy_type) {
        setBookingError('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      const appointmentData = {
        patient_id: currentUser?.id,
        doctor_id: doctor.id,
        therapy_type: bookingData.therapy_type,
        preferred_date: bookingData.preferred_date,
        preferred_time: bookingData.preferred_time,
        reason_for_visit: bookingData.reason_for_visit,
        duration_minutes: bookingData.duration_minutes,
      };

      const result = await api.bookAppointment(appointmentData);
      if (result.status === 'rejected') {
        setBookingError(result.rejection_reason || 'That time is not available. Please book another time from the doctor availability.');
        return;
      }
      setBookingSuccess(true);

      // Reset form and close modal after success
      setTimeout(() => {
        setShowBookingModal(false);
        setBookingData({
          preferred_date: '',
          preferred_time: '',
          reason_for_visit: '',
          therapy_type: '',
          duration_minutes: 60,
        });
        setBookingSuccess(false);
      }, 2000);
    } catch (err: any) {
      console.error('Booking error:', err);
      setBookingError(err.message || 'Failed to book appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setError('Doctor ID not provided');
      setLoading(false);
      return;
    }

    api.getPractitioner(id)
      .then(doc => {
        setDoctor(doc);
      })
      .catch(err => {
        console.error('Failed to load doctor:', err);
        setError('Failed to load doctor profile');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Load therapy types and weekly availability when booking modal opens
  useEffect(() => {
    if (showBookingModal && therapies.length === 0) {
      setTherapiesLoading(true);
      api.getTherapyTypes()
        .then(data => {
          setTherapies(Array.isArray(data) ? data : []);
        })
        .catch(err => {
          console.error('Failed to load therapies:', err);
          setTherapies([]);
        })
        .finally(() => setTherapiesLoading(false));
    }
    if (showBookingModal && id) {
      api.getAvailability(id)
        .then(data => setWeeklyAvailability(Array.isArray(data) ? data : []))
        .catch(() => setWeeklyAvailability([]));
    }
  }, [showBookingModal, therapies.length, id]);

  // Fetch available slots when date changes
  useEffect(() => {
    if (!bookingData.preferred_date || !id) {
      setAvailableSlots([]);
      setSlotsChecked(false);
      return;
    }
    setSlotsLoading(true);
    setSlotsChecked(false);
    setBookingData(prev => ({ ...prev, preferred_time: '' }));
    api.checkAvailability(id, bookingData.preferred_date)
      .then(data => {
        setAvailableSlots(data.slots || []);
        setSlotsChecked(true);
      })
      .catch(() => {
        setAvailableSlots([]);
        setSlotsChecked(true);
      })
      .finally(() => setSlotsLoading(false));
  }, [bookingData.preferred_date, id]);

  const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatSlotTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-saffron-500" />
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen bg-stone-50 p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-saffron-600 hover:text-saffron-700 mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">{error || 'Doctor not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-saffron-600 hover:text-saffron-700 mb-6 font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>

        {/* Doctor Card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden">
          {/* Header gradient */}
          <div className="h-24 bg-gradient-to-r from-saffron-400 to-saffron-600" />

          <div className="px-8 py-8">
            {/* Avatar + Name Section */}
            <div className="flex items-start gap-6 mb-8 -mt-16 relative z-10">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-saffron-100 to-saffron-200 flex items-center justify-center text-4xl font-bold text-saffron-700 border-4 border-white shadow-lg">
                {doctor.name?.charAt(0)?.toUpperCase() || 'D'}
              </div>
              <div className="flex-1 mt-4">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-3xl font-bold text-stone-800">
                    Dr. {doctor.name?.replace(/^Dr\.?\s*/i, '') || 'Unknown'}
                  </h1>
                  {doctor.verified && (
                    <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-sm font-semibold text-emerald-700">
                      <ShieldCheck className="w-4 h-4" />
                      Verified
                    </span>
                  )}
                </div>
                {doctor.specialization && (
                  <p className="text-lg text-saffron-700 font-semibold">{doctor.specialization}</p>
                )}
                {doctor.doctor_type && (
                  <p className="text-sm text-stone-600 mb-4">{doctor.doctor_type}</p>
                )}
                {/* Action Buttons */}
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleMessage}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    <Send className="w-4 h-4" />
                    Message
                  </button>
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="flex items-center gap-2 bg-saffron-500 hover:bg-saffron-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    Book Appointment
                  </button>
                </div>
              </div>
            </div>

            {/* Bio */}
            {doctor.bio && (
              <div className="mb-8 pb-8 border-b border-stone-100">
                <h2 className="text-sm font-semibold text-stone-700 mb-2">About</h2>
                <p className="text-stone-600 leading-relaxed">{doctor.bio}</p>
              </div>
            )}

            {/* Key Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8 pb-8 border-b border-stone-100">
              {doctor.experience_years > 0 && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-saffron-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-stone-600 uppercase">Experience</p>
                    <p className="text-lg font-bold text-stone-800">
                      {doctor.experience_years} {doctor.experience_years === 1 ? 'Year' : 'Years'}
                    </p>
                  </div>
                </div>
              )}

              {doctor.license_number && (
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-saffron-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-stone-600 uppercase">License</p>
                    <p className="text-sm font-bold text-stone-800 break-words">{doctor.license_number}</p>
                  </div>
                </div>
              )}

              {doctor.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-saffron-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-stone-600 uppercase">Phone</p>
                    <p className="text-sm font-bold text-stone-800">{doctor.phone}</p>
                  </div>
                </div>
              )}

              {doctor.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-saffron-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-stone-600 uppercase">Email</p>
                    <p className="text-sm font-bold text-stone-800 break-words">{doctor.email}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Qualifications */}
            {doctor.qualifications && (
              <div className="mb-8 pb-8 border-b border-stone-100">
                <h2 className="text-sm font-semibold text-stone-700 mb-3">Qualifications</h2>
                <div className="bg-stone-50 rounded-lg p-4 text-sm text-stone-700 whitespace-pre-wrap">
                  {doctor.qualifications}
                </div>
              </div>
            )}

            {/* Location */}
            {(doctor.address || doctor.city) && (
              <div className="mb-8">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h2 className="text-sm font-semibold text-stone-700 mb-2">Location</h2>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      {doctor.address && (
                        <p className="font-semibold text-stone-800">{doctor.address}</p>
                      )}
                      {(doctor.city || doctor.state || doctor.zipcode) && (
                        <p className="text-sm text-stone-600 mt-1">
                          {[doctor.city, doctor.state, doctor.zipcode]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-stone-800">Book Appointment</h2>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-stone-500 hover:text-stone-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {bookingSuccess && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-semibold text-center">
                ✓ Appointment request sent! The doctor will review your request.
              </div>
            )}

            {bookingError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 font-semibold text-sm">
                {bookingError}
              </div>
            )}

            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Therapy Type *
                </label>
                <select
                  value={bookingData.therapy_type}
                  onChange={(e) => setBookingData({ ...bookingData, therapy_type: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-saffron-500 focus:border-transparent"
                  disabled={therapiesLoading}
                >
                  <option value="">
                    {therapiesLoading ? 'Loading therapies...' : therapies.length === 0 ? 'No therapies available' : 'Select therapy...'}
                  </option>
                  {therapies.map((therapy) => (
                    <option key={therapy.id} value={therapy.name}>
                      {therapy.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Preferred Date *
                </label>
                <input
                  type="date"
                  value={bookingData.preferred_date}
                  onChange={(e) => setBookingData({ ...bookingData, preferred_date: e.target.value, preferred_time: '' })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-saffron-500 focus:border-transparent"
                />
              </div>

              {/* Available Time Slots */}
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Available Time Slots *
                </label>
                {!bookingData.preferred_date ? (
                  <div className="flex items-center gap-2 text-sm text-stone-400 bg-stone-50 rounded-lg px-4 py-3 border border-stone-200">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    Select a date first to see available time slots
                  </div>
                ) : slotsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-stone-500 bg-stone-50 rounded-lg px-4 py-3 border border-stone-200">
                    <div className="w-4 h-4 border-2 border-saffron-500 border-t-transparent rounded-full animate-spin" />
                    Checking availability...
                  </div>
                ) : slotsChecked && availableSlots.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Dr. {doctor?.name?.replace(/^Dr\.?\s*/i, '') || 'This doctor'} is not available on this day. Try another date.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setBookingData({ ...bookingData, preferred_time: slot })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          bookingData.preferred_time === slot
                            ? 'bg-saffron-500 text-white border-saffron-500 shadow-md scale-105'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-saffron-300 hover:bg-saffron-50'
                        }`}
                      >
                        {formatSlotTime(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Session Duration (minutes)
                </label>
                <select
                  value={bookingData.duration_minutes}
                  onChange={(e) => setBookingData({ ...bookingData, duration_minutes: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-saffron-500 focus:border-transparent"
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={120}>120 minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Reason for Visit
                </label>
                <textarea
                  placeholder="Describe your health concern or reason for the appointment..."
                  value={bookingData.reason_for_visit}
                  onChange={(e) => setBookingData({ ...bookingData, reason_for_visit: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-saffron-500 focus:border-transparent resize-none h-24"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 font-semibold rounded-lg hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-saffron-500 hover:bg-saffron-600 disabled:bg-saffron-300 text-white font-semibold rounded-lg transition disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Booking...' : 'Book Now'}
                </button>
              </div>
            </form>

            {/* Doctor's Weekly Availability */}
            {weeklyAvailability.length > 0 && (
              <div className="mt-5 pt-4 border-t border-stone-200">
                <h3 className="text-sm font-semibold text-stone-600 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-saffron-500" />
                  Dr. {doctor?.name?.replace(/^Dr\.?\s*/i, '')}'s Weekly Schedule
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {weeklyAvailability
                    .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
                    .map((slot: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-stone-50 rounded-lg px-3 py-1.5 border border-stone-100">
                      <span className="font-semibold text-stone-700 w-8">{DAY_NAMES_SHORT[slot.day_of_week]}</span>
                      <span className="text-stone-500">
                        {formatSlotTime(slot.start_time)} – {formatSlotTime(slot.end_time)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
