import { Router, Request, Response } from 'express';
import db, { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { sendNotification } from '../services/notification-service';
import { 
  emitDoctorAppointmentRequest, 
  emitTreatmentPlanCreated,
  emitPendingAppointmentsCount 
} from '../services/realtime';

const router = Router();

// Helper to enrich appointment with names and details
async function enrichAppointment(apt: any) {
  const pDoc = await collections.patients().doc(apt.patient_id).get();
  const drDoc = await collections.practitioners().doc(apt.doctor_id).get();
  const ttDoc = apt.therapy_type_id ? await collections.therapyTypes().doc(apt.therapy_type_id).get() : null;
  
  apt.patient_name = pDoc.exists ? pDoc.data()?.name : 'Unknown Patient';
  apt.patient_email = pDoc.exists ? pDoc.data()?.email : '';
  apt.patient_phone = pDoc.exists ? pDoc.data()?.phone : '';
  apt.doctor_name = drDoc.exists ? drDoc.data()?.name : 'Unknown Doctor';
  apt.doctor_specialization = drDoc.exists ? drDoc.data()?.specialization : '';
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

    // Create appointment request with 'pending' status
    const appointmentId = uuidv4();
    const appointment = {
      patient_id,
      doctor_id,
      patient_name: '',
      doctor_name: '',
      therapy_type_id: therapy_type_id || null,
      therapy_type,
      preferred_date,
      preferred_time,
      reason_for_visit: reason_for_visit || '',
      duration_minutes,
      status: 'pending' as const, // pending, accepted, rejected, completed
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      accepted_at: null,
      rejected_at: null,
      rejection_reason: null,
    };

    // Save appointment
    await collections.appointments().doc(appointmentId).set({ id: appointmentId, ...appointment });

    // Enrich appointment details before returning
    const enrichedAppointment = await enrichAppointment({ id: appointmentId, ...appointment });

    // Get doctor details
    const doctorDoc = await collections.practitioners().doc(doctor_id).get();
    const doctorData = doctorDoc.data();
    const doctor_email = doctorData?.email;

    // Emit real-time notification to doctor via Socket.io
    emitDoctorAppointmentRequest(doctor_id, {
      appointment_id: appointmentId,
      patient_id,
      patient_name: enrichedAppointment.patient_name,
      patient_email: enrichedAppointment.patient_email,
      therapy_type: therapy_type,
      preferred_date,
      preferred_time,
      reason_for_visit,
    });

    // Send email notification to patient (if email is enabled)
    // Note: Doctor gets Socket.io real-time notification instead
    const patientDoc = await collections.patients().doc(patient_id).get();
    const patientEmail = patientDoc.data()?.email;

    res.status(201).json(enrichedAppointment);
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
      await sendNotification({
        patient_id: appointment.patient_id,
        type: 'appointment_accepted',
        title: `Appointment Confirmed with ${appointment.doctor_name}`,
        message: `Your appointment for ${appointment.therapy_type} on ${appointment.preferred_date} at ${appointment.preferred_time} has been confirmed. ${availability_note || ''}`,
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
      await sendNotification({
        patient_id: appointment.patient_id,
        type: 'appointment_rejected',
        title: `Appointment Not Available - ${appointment.doctor_name}`,
        message: `Unfortunately, ${appointment.doctor_name} is not available for your requested appointment on ${appointment.preferred_date}. Reason: ${rejection_reason}`,
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

export default router;
