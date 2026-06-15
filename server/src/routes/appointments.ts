import { Router, Request, Response } from 'express';
import { collections, docToObj, queryToArray, batch } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { notifyPatient, notifyDoctors } from '../services/notification-service';
import { emitTreatmentPlanCreated } from '../services/realtime';

const AI_AUTO_APPROVE_THRESHOLD = 70;

async function findMatchingTherapyType(therapyName: string): Promise<any | null> {
  const snap = await collections.therapyTypes().get();
  const types = queryToArray(snap);
  return types.find(t => t.name.toLowerCase() === therapyName.toLowerCase()) || null;
}

// Compute an AI score (0–100) for an appointment to decide auto-approval.
// Considers: dosha–therapy affinity, doctor availability, patient history.
async function aiScoreAppointment(appointment: any): Promise<{
  score: number; reason: string; auto_approved: boolean;
}> {
  let score = 50;
  const parts: string[] = ['Base score: 50'];

  // 1. Dosha–therapy affinity (up to +25)
  const [pDoc, tt] = await Promise.all([
    appointment.patient_id ? collections.patients().doc(appointment.patient_id).get() : null,
    findMatchingTherapyType(appointment.therapy_type),
  ]);
  const patient = pDoc?.exists ? pDoc.data() : null;
  const dosha = patient?.current_dosha_imbalance || patient?.prakriti || null;

  const DOSE_AFFINITY: Record<string, Record<string, number>> = {
    'Basti':    { Vata: 0.95, Pitta: 0.50, Kapha: 0.40 },
    'Nasya':    { Vata: 0.60, Pitta: 0.65, Kapha: 0.85 },
    'Vamana':   { Vata: 0.30, Pitta: 0.45, Kapha: 0.95 },
    'Virechana':{ Vata: 0.40, Pitta: 0.95, Kapha: 0.50 },
    'Abhyanga': { Vata: 0.90, Pitta: 0.65, Kapha: 0.55 },
    'Swedana':  { Vata: 0.80, Pitta: 0.40, Kapha: 0.70 },
    'Shirodhara':{ Vata: 0.85, Pitta: 0.80, Kapha: 0.50 },
  };
  if (dosha && tt?.name) {
    const name = Object.keys(DOSE_AFFINITY).find(k =>
      tt.name.toLowerCase().includes(k.toLowerCase())
    ) || tt.name;
    const affinityKey = ['Vata','Pitta','Kapha'].find(d => dosha.includes(d)) || 'Pitta';
    const aff = DOSE_AFFINITY[name]?.[affinityKey];
    if (aff != null) {
      const pts = Math.round(aff * 25);
      score += pts;
      parts.push(`Dosha–therapy affinity: +${pts} (${dosha} × ${tt.name} = ${Math.round(aff * 100)}%)`);
    }
  }

  // 2. Available slot bonus (up to +10)
  if (appointment.availability_note?.includes('Slot is available')) {
    score += 10;
    parts.push('Slot available: +10');
  }

  // 3. Patient history (up to +15)
  try {
    const historySnap = await collections.therapySessions()
      .where('patient_id', '==', appointment.patient_id)
      .get();
    const history = queryToArray(historySnap);
    const completed = history.filter(s => s.status === 'completed').length;
    const noShows = history.filter(s => s.status === 'no-show').length;
    const cancelled = history.filter(s => s.status === 'cancelled').length;

    if (completed >= 3) { score += 15; parts.push('Regular patient (3+ completed): +15'); }
    else if (completed >= 1) { score += 8; parts.push('Returning patient: +8'); }
    else { score += 3; parts.push('New patient: +3'); }

    if (noShows > 0) { score -= 10 * noShows; parts.push(`No-show history: -${10 * noShows}`); }
    if (cancelled > 2) { score -= 10; parts.push('Frequent cancellations: -10'); }
  } catch { /* history unavailable — skip */ }

  // 4. Previously treated by this doctor (up to +10)
  try {
    const prevSnap = await collections.therapySessions()
      .where('patient_id', '==', appointment.patient_id)
      .where('practitioner_id', '==', appointment.doctor_id)
      .get();
    if (prevSnap.size > 0) {
      score += 10;
      parts.push('Previously treated by this doctor: +10');
    }
  } catch { /* skip */ }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    reason: parts.join('; '),
    auto_approved: score >= AI_AUTO_APPROVE_THRESHOLD,
  };
}

async function createSessionFromAppointment(appointment: any): Promise<string> {
  const sessionId = uuidv4();
  const now = new Date().toISOString();
  const session = {
    id: sessionId, patient_id: appointment.patient_id,
    practitioner_id: appointment.doctor_id,
    therapy_type_id: appointment.therapy_type_id || null,
    therapy_name: appointment.therapy_type,
    scheduled_date: appointment.preferred_date,
    scheduled_time: appointment.preferred_time,
    duration_minutes: appointment.duration_minutes || 60,
    status: 'scheduled',
    created_at: now, updated_at: now,
    notes: `Booked via appointment request: ${appointment.reason_for_visit || ''}`.trim(),
    appointment_id: appointment.id,
    is_ml_generated: true,
  };
  await collections.therapySessions().doc(sessionId).set(session);
  return sessionId;
}

const router = Router();

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function checkDoctorAvailability(
  doctor_id: string,
  preferred_date: string,
  preferred_time: string,
  duration_minutes: number
) {
  const dayOfWeek = new Date(`${preferred_date}T12:00:00`).getDay();
  if (Number.isNaN(dayOfWeek)) {
    return { available: false, reason: 'Invalid appointment date.' };
  }

  const requestedEnd = addMinutesToTime(preferred_time, duration_minutes);
  const availSnap = await collections.practitionerAvailability()
    .where('practitioner_id', '==', doctor_id)
    .where('day_of_week', '==', dayOfWeek)
    .get();

  const availability = queryToArray(availSnap);
  const matchesAvailability = availability.some((slot: any) =>
    preferred_time >= slot.start_time && requestedEnd <= slot.end_time
  );

  if (!matchesAvailability) {
    return {
      available: false,
      reason: 'The requested time is outside the doctor availability.',
      available_windows: availability.map((slot: any) => `${slot.start_time}-${slot.end_time}`),
    };
  }

  const sessionSnap = await collections.therapySessions()
    .where('practitioner_id', '==', doctor_id)
    .where('scheduled_date', '==', preferred_date)
    .get();

  const hasSessionConflict = sessionSnap.docs
    .map(d => d.data())
    .filter(s => ['pending', 'scheduled', 'in-progress'].includes(s.status))
    .some(s => preferred_time < addMinutesToTime(s.scheduled_time, s.duration_minutes || 60) && requestedEnd > s.scheduled_time);

  if (hasSessionConflict) {
    return { available: false, reason: 'The doctor already has another therapy session at this time.' };
  }

  const appointmentSnap = await collections.appointments()
    .where('doctor_id', '==', doctor_id)
    .where('preferred_date', '==', preferred_date)
    .get();

  const hasAppointmentConflict = appointmentSnap.docs
    .map(d => d.data())
    .filter(a => a.status === 'accepted')
    .some(a => preferred_time < addMinutesToTime(a.preferred_time, a.duration_minutes || 60) && requestedEnd > a.preferred_time);

  if (hasAppointmentConflict) {
    return { available: false, reason: 'The doctor already has an accepted appointment at this time.' };
  }

  return { available: true };
}

async function sendUnavailableMessage(appointment: any, reason: string, availableWindows: string[] = []) {
  const availableText = availableWindows.length > 0
    ? ` Available windows for that day: ${availableWindows.join(', ')}.`
    : '';
  const content = `The requested therapy slot is not available. ${reason} Please book another time that matches the doctor's availability.${availableText}`;

  await notifyPatient({
    patient_id: appointment.patient_id,
    type: 'appointment_rejected',
    title: `Please choose another time with ${appointment.doctor_name}`,
    message: content,
    scheduled_for: `${appointment.preferred_date} ${appointment.preferred_time}`,
  });

  const messageId = uuidv4();
  const conversationId = `${[appointment.patient_id, appointment.doctor_id].sort().join('_')}`;
  const now = new Date().toISOString();
  await collections.messages().doc(messageId).set({
    id: messageId,
    conversation_id: conversationId,
    sender_id: appointment.doctor_id,
    receiver_id: appointment.patient_id,
    content,
    message_type: 'system_availability',
    created_at: now,
    read: false,
  });

  await collections.conversations().doc(conversationId).set(
    {
      last_message: content,
      last_message_at: now,
      last_message_from: appointment.doctor_id,
    },
    { merge: true }
  );
}

// Helper to enrich appointment with names and details
async function enrichAppointment(apt: any) {
  const [pDoc, drDoc, ttDoc] = await Promise.all([
    apt.patient_id ? collections.patients().doc(apt.patient_id).get() : Promise.resolve(null),
    apt.doctor_id ? collections.practitioners().doc(apt.doctor_id).get() : Promise.resolve(null),
    apt.therapy_type_id ? collections.therapyTypes().doc(apt.therapy_type_id).get() : Promise.resolve(null),
  ]);

  apt.patient_name = pDoc?.exists ? pDoc.data()?.name : apt.patient_name || 'Unknown Patient';
  apt.patient_email = pDoc?.exists ? pDoc.data()?.email : apt.patient_email || '';
  apt.patient_phone = pDoc?.exists ? pDoc.data()?.phone : apt.patient_phone || '';
  apt.doctor_name = drDoc?.exists ? drDoc.data()?.name : apt.doctor_name || 'Unknown Doctor';
  apt.doctor_specialization = drDoc?.exists ? drDoc.data()?.specialization : apt.doctor_specialization || '';
  apt.therapy_name = ttDoc?.exists ? ttDoc.data()?.name : apt.therapy_type;
  apt.therapy_description = ttDoc?.exists ? ttDoc.data()?.description : '';
  
  return apt;
}

/**
 * POST /appointments - Create appointment booking request
 * Patient books a doctor for treatment
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      patient_id, 
      doctor_id, 
      therapy_type_id, 
      therapy_type,
      preferred_date, 
      preferred_time, 
      reason_for_visit,
      duration_minutes = 60 
    } = req.body;

    // Validation
    if (!patient_id || !doctor_id || !therapy_type || !preferred_date || !preferred_time) {
      return res.status(400).json({ 
        error: 'Missing required fields: patient_id, doctor_id, therapy_type, preferred_date, preferred_time' 
      });
    }

    // Auto-reject any existing pending requests for the same slot by the same patient
    const existingSnap = await collections.appointments()
      .where('patient_id', '==', patient_id)
      .get();
    const existingPending = existingSnap.docs.filter(d => {
      const data = d.data();
      return data.doctor_id === doctor_id && data.preferred_date === preferred_date && data.preferred_time === preferred_time && data.status === 'pending';
    });
    if (existingPending.length > 0) {
      const now = new Date().toISOString();
      const fbBatch = batch();
      for (const doc of existingPending) {
        fbBatch.update(doc.ref, {
          status: 'rejected',
          rejection_reason: 'Auto-rejected — you submitted a newer request for the same slot.',
          rejected_at: now,
          updated_at: now,
        });
      }
      await fbBatch.commit();
    }

    const availability = await checkDoctorAvailability(
      doctor_id,
      preferred_date,
      preferred_time,
      duration_minutes
    );
    const now = new Date().toISOString();

    const appointmentId = uuidv4();

    if (!availability.available) {
      // Slot not available — reject immediately with suggestion
      const rejectedAppointment: any = {
        id: appointmentId, patient_id, doctor_id,
        patient_name: '', doctor_name: '',
        therapy_type_id: therapy_type_id || null, therapy_type,
        preferred_date, preferred_time,
        reason_for_visit: reason_for_visit || '', duration_minutes,
        status: 'rejected',
        created_at: now, updated_at: now,
        accepted_at: null, rejected_at: now,
        rejection_reason: availability.reason || 'The requested time is not available.',
        availability_note: 'Slot not available',
        auto_decision: true,
        ai_score: null, ai_decision_reason: null,
      };

      await collections.appointments().doc(appointmentId).set(rejectedAppointment);
      const enriched = await enrichAppointment(rejectedAppointment);

      // Send suggestion to patient
      const availText = availability.available_windows?.length
        ? ` Available windows: ${availability.available_windows.join(', ')}.`
        : '';

      await notifyPatient({
        patient_id,
        type: 'appointment_rejected',
        title: 'Time Not Available',
        message: `Sorry, Dr. ${enriched.doctor_name} is not available at ${preferred_time} on ${preferred_date}.${availText} Please choose a different time.`,
        scheduled_for: `${preferred_date} ${preferred_time}`,
      });

      return res.status(200).json({
        ...enriched,
        status: 'rejected',
        rejection_reason: availability.reason,
        available_windows: availability.available_windows || [],
        auto_approved: false,
        message: `That time is not available.${availText}`,
      });
    }

    // Slot is available — auto-approve and create session
    const appointment: any = {
      id: appointmentId, patient_id, doctor_id,
      patient_name: '', doctor_name: '',
      therapy_type_id: therapy_type_id || null, therapy_type,
      preferred_date, preferred_time,
      reason_for_visit: reason_for_visit || '', duration_minutes,
      status: 'accepted',
      created_at: now, updated_at: now,
      accepted_at: now, rejected_at: null, rejection_reason: null,
      availability_note: 'Slot is available',
      auto_decision: true,
      ai_score: null, ai_decision_reason: null,
    };

    await collections.appointments().doc(appointmentId).set(appointment);

    const sessionId = await createSessionFromAppointment(appointment);
    const enriched = await enrichAppointment(appointment);

    // Notify patient
    await notifyPatient({
      patient_id,
      type: 'appointment_accepted',
      title: 'Appointment Confirmed ✓',
      message: `Great news! Your ${therapy_type} appointment on ${preferred_date} at ${preferred_time} with Dr. ${enriched.doctor_name} is confirmed. See you there!`,
      scheduled_for: `${preferred_date} ${preferred_time}`,
    });

    // Notify doctor
    await notifyDoctors({
      title: 'New Appointment Scheduled',
      message: `${enriched.patient_name || 'A patient'} booked ${therapy_type} on ${preferred_date} at ${preferred_time}. A session has been created in your schedule.`,
    });

    emitTreatmentPlanCreated(appointment.patient_id, {
      appointment_id: appointmentId,
      session_id: sessionId,
      doctor_name: enriched.doctor_name,
      therapy_type,
      scheduled_date: preferred_date,
      scheduled_time: preferred_time,
      auto_approved: true,
    });

    res.status(201).json({
      ...enriched,
      auto_approved: true,
      message: 'Your appointment is confirmed! Your session has been scheduled.',
    });
  } catch (error: any) {
    console.error('[Appointments] Error creating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /appointments - Get appointments
 * Query params: patient_id, doctor_id, status (pending, accepted, rejected, completed)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { patient_id, doctor_id, status } = req.query;
    
    // Must have at least one filter parameter
    if (!patient_id && !doctor_id) {
      return res.status(400).json({ 
        error: 'Must provide either patient_id or doctor_id query parameter' 
      });
    }

    let query: FirebaseFirestore.Query = collections.appointments();

    // Apply single filter (prefer patient_id, but fallback to doctor_id)
    if (patient_id) {
      query = query.where('patient_id', '==', patient_id);
    } else if (doctor_id) {
      query = query.where('doctor_id', '==', doctor_id);
    }

    // Get all appointments WITHOUT ordering in Firestore (avoids composite index requirement)
    const snap = await query.get();
    let appointments = queryToArray(snap);

    // Additional filtering in code (for status filter)
    if (status) {
      appointments = appointments.filter(apt => apt.status === status);
    }

    // Sort by created_at descending in JavaScript (avoids Firestore composite index)
    appointments.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA; // Descending order
    });

    // Enrich with names and details
    for (const apt of appointments) {
      await enrichAppointment(apt);
    }

    res.json(appointments);
  } catch (error: any) {
    console.error('[Appointments] Error fetching appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /appointments/:id - Get appointment by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await collections.appointments().doc(req.params.id).get();
    const appointment = docToObj(doc);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await enrichAppointment(appointment);
    res.json(appointment);
  } catch (error: any) {
    console.error('[Appointments] Error fetching appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /appointments/:id/accept - Doctor accepts appointment
 * Creates therapy session and treatment plan
 */
router.patch('/:id/accept', async (req: Request, res: Response) => {
  try {
    const appointmentId = req.params.id;
    const { availability_note } = req.body;

    // Get appointment
    const aptDoc = await collections.appointments().doc(appointmentId).get();
    const appointment = docToObj(aptDoc);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({ error: `Cannot accept appointment with status: ${appointment.status}` });
    }

    // Update appointment status
    const updatedAt = new Date().toISOString();
    await collections.appointments().doc(appointmentId).update({
      status: 'accepted',
      accepted_at: updatedAt,
      updated_at: updatedAt,
      availability_note: availability_note || 'Doctor accepted this appointment',
    });

    // Get updated appointment
    const updatedAptDoc = await collections.appointments().doc(appointmentId).get();
    const updatedAppointment = docToObj(updatedAptDoc);
    await enrichAppointment(updatedAppointment);

    // Create therapy session from appointment
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      patient_id: appointment.patient_id,
      practitioner_id: appointment.doctor_id,
      therapy_type_id: appointment.therapy_type_id || null,
      therapy_name: appointment.therapy_type,
      scheduled_date: appointment.preferred_date,
      scheduled_time: appointment.preferred_time,
      duration_minutes: appointment.duration_minutes || 60,
      status: 'scheduled', // scheduled, in-progress, completed, cancelled
      created_at: updatedAt,
      updated_at: updatedAt,
      notes: `Booked via appointment request: ${appointment.reason_for_visit}`,
      appointment_id: appointmentId, // Link back to appointment
    };

    await collections.therapySessions().doc(sessionId).set(session);

    // Notify patient about acceptance
    const patientDoc = await collections.patients().doc(appointment.patient_id).get();
    const patientEmail = patientDoc.data()?.email;

    emitTreatmentPlanCreated(appointment.patient_id, {
      appointment_id: appointmentId,
      session_id: sessionId,
      doctor_name: appointment.doctor_name,
      therapy_type: appointment.therapy_type,
      scheduled_date: appointment.preferred_date,
      scheduled_time: appointment.preferred_time,
    });

    // Notify patient via in-app notification
    try {
      await notifyPatient({
        patient_id: appointment.patient_id,
        type: 'appointment_accepted',
        title: `Appointment Confirmed with ${appointment.doctor_name}`,
        message: `Your appointment for ${appointment.therapy_type} on ${appointment.preferred_date} at ${appointment.preferred_time} has been confirmed. ${availability_note || ''}`,
      });
      await notifyDoctors({
        title: 'Appointment Confirmed',
        message: `${appointment.patient_name} confirmed for ${appointment.therapy_type} on ${appointment.preferred_date} at ${appointment.preferred_time}.`,
      });
    } catch (notifError) {
      console.warn('[Appointments] Could not send acceptance notification:', notifError);
    }

    res.json({
      appointment: updatedAppointment,
      session: session,
      message: 'Appointment accepted successfully',
    });
  } catch (error: any) {
    console.error('[Appointments] Error accepting appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /appointments/:id/reject - Doctor rejects appointment
 * Sets rejection reason and status
 */
router.patch('/:id/reject', async (req: Request, res: Response) => {
  try {
    const appointmentId = req.params.id;
    const { rejection_reason, send_apology_message = true } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({ error: 'rejection_reason is required' });
    }

    // Get appointment
    const aptDoc = await collections.appointments().doc(appointmentId).get();
    const appointment = docToObj(aptDoc);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject appointment with status: ${appointment.status}` });
    }

    // Update appointment status
    const updatedAt = new Date().toISOString();
    await collections.appointments().doc(appointmentId).update({
      status: 'rejected',
      rejected_at: updatedAt,
      updated_at: updatedAt,
      rejection_reason: rejection_reason,
    });

    // Get updated appointment
    const updatedAptDoc = await collections.appointments().doc(appointmentId).get();
    const updatedAppointment = docToObj(updatedAptDoc);
    await enrichAppointment(updatedAppointment);

    // Send notification to patient
    const patientDoc = await collections.patients().doc(appointment.patient_id).get();
    const patientEmail = patientDoc.data()?.email;

    try {
      await notifyPatient({
        patient_id: appointment.patient_id,
        type: 'appointment_rejected',
        title: `Appointment Not Available - ${appointment.doctor_name}`,
        message: `Unfortunately, ${appointment.doctor_name} is not available for your requested appointment on ${appointment.preferred_date}. Reason: ${rejection_reason}`,
      });
      await notifyDoctors({
        title: 'Appointment Rejected',
        message: `Rejected ${appointment.patient_name}'s ${appointment.therapy_type} appointment on ${appointment.preferred_date} at ${appointment.preferred_time}. Reason: ${rejection_reason}`,
      });
    } catch (notifError) {
      console.warn('[Appointments] Could not send rejection notification:', notifError);
    }

    // If requested, create a system message for apology context
    if (send_apology_message) {
      // Create system notification
      const systemMessage = {
        id: uuidv4(),
        conversation_id: `${[appointment.patient_id, appointment.doctor_id].sort().join('_')}`,
        sender_id: appointment.doctor_id,
        receiver_id: appointment.patient_id,
        content: `I apologize, but I'm not available for your requested appointment. Reason: ${rejection_reason}. Please feel free to contact me to reschedule.`,
        message_type: 'system_apology',
        created_at: updatedAt,
        read: false,
      };

      await collections.messages().doc(systemMessage.id).set(systemMessage);

      // Update conversation to show this apology message
      const conversationId = `${[appointment.patient_id, appointment.doctor_id].sort().join('_')}`;
      await collections.conversations().doc(conversationId).set(
        {
          last_message: systemMessage.content,
          last_message_at: updatedAt,
          last_message_from: appointment.doctor_id,
        },
        { merge: true }
      );
    }

    res.json({
      appointment: updatedAppointment,
      message: 'Appointment rejected successfully and patient notified',
    });
  } catch (error: any) {
    console.error('[Appointments] Error rejecting appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /appointments/doctor/:doctor_id/pending - Get pending appointments for a doctor
 */
router.get('/doctor/:doctor_id/pending', async (req: Request, res: Response) => {
  try {
    const { doctor_id } = req.params;
    // Fetch all appointments for this doctor (without separate status filter to avoid composite index)
    const snap = await collections.appointments()
      .where('doctor_id', '==', doctor_id)
      .get();

    let appointments = queryToArray(snap)
      .filter(apt => apt.status === 'pending');

    // Sort by created_at descending in JavaScript (avoids Firestore composite index)
    appointments.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA; // Descending order
    });

    // Enrich with patient names
    for (const apt of appointments) {
      await enrichAppointment(apt);
    }

    res.json(appointments);
  } catch (error: any) {
    console.error('[Appointments] Error fetching pending appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /appointments/patient/:patient_id/history - Get all appointments for a patient
 */
router.get('/patient/:patient_id/history', async (req: Request, res: Response) => {
  try {
    const { patient_id } = req.params;
    const snap = await collections.appointments()
      .where('patient_id', '==', patient_id)
      .get();

    let appointments = queryToArray(snap);

    // Sort by created_at descending in JavaScript (avoids Firestore composite index)
    appointments.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA; // Descending order
    });

    // Enrich with doctor names
    for (const apt of appointments) {
      await enrichAppointment(apt);
    }

    res.json(appointments);
  } catch (error: any) {
    console.error('[Appointments] Error fetching patient appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /appointments/clear - Clear appointment history
 * Supports filtering by doctor_id or patient_id
 */
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    const { patient_id, doctor_id, older_than } = req.query;

    let query: FirebaseFirestore.Query = collections.appointments();
    if (patient_id) query = query.where('patient_id', '==', patient_id as string);
    if (doctor_id) query = query.where('doctor_id', '==', doctor_id as string);

    const snap = await query.get();
    const fbBatch = batch();
    snap.docs.forEach(doc => fbBatch.delete(doc.ref));
    await fbBatch.commit();

    res.json({ message: 'Appointment history cleared', count: snap.size });
  } catch (error: any) {
    console.error('[Appointments] Error clearing appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
