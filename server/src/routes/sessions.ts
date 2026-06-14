import { Router, Request, Response } from 'express';
import db, { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { notifyPatient, notifyDoctors } from '../services/notification-service';
import { emitSessionUpdate, emitSessionCreated, emitDashboardRefresh, emitTherapyProgressRefresh, emitDoctorAppointmentRequest, emitTreatmentPlanCreated } from '../services/realtime';

async function sendSessionMessage(session: any, senderId: string, receiverId: string, content: string, messageType: string) {
  try {
    const messageId = uuidv4();
    const conversationId = [receiverId, senderId].sort().join('_');
    const now = new Date().toISOString();
    await collections.messages().doc(messageId).set({
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      message_type: messageType,
      created_at: now,
      read: false,
    });
    await collections.conversations().doc(conversationId).set({
      last_message: content,
      last_message_at: now,
      last_message_from: senderId,
    }, { merge: true });
  } catch (err) {
    console.warn('[Sessions] Could not send message:', err);
  }
}

const router = Router();

// Helper to enrich session with joined names
async function enrichSession(s: any) {
  try {
    // Safely access therapy type
    if (s.therapy_type_id && s.therapy_type_id.trim()) {
      const ttDoc = await collections.therapyTypes().doc(s.therapy_type_id).get();
      s.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
      s.category = ttDoc.exists ? ttDoc.data()?.category : '';
      s.pre_procedure_instructions = ttDoc.exists ? ttDoc.data()?.pre_procedure_instructions : '';
      s.post_procedure_instructions = ttDoc.exists ? ttDoc.data()?.post_procedure_instructions : '';
    } else {
      s.therapy_name = '';
      s.category = '';
      s.pre_procedure_instructions = '';
      s.post_procedure_instructions = '';
    }
    
    // Safely access patient
    if (s.patient_id && s.patient_id.trim()) {
      const pDoc = await collections.patients().doc(s.patient_id).get();
      s.patient_name = pDoc.exists ? pDoc.data()?.name : '';
    } else {
      s.patient_name = '';
    }
    
    // Safely access practitioner
    if (s.practitioner_id && s.practitioner_id.trim()) {
      const prDoc = await collections.practitioners().doc(s.practitioner_id).get();
      s.practitioner_name = prDoc.exists ? prDoc.data()?.name : '';
    } else {
      s.practitioner_name = '';
    }
  } catch (error) {
    console.error('[Sessions] Error enriching session:', error);
    // Set defaults if enrichment fails
    s.therapy_name = '';
    s.category = '';
    s.patient_name = '';
    s.practitioner_name = '';
    s.pre_procedure_instructions = '';
    s.post_procedure_instructions = '';
  }
  return s;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function validatePractitionerSlot(
  practitioner_id: string,
  scheduled_date: string,
  scheduled_time: string,
  duration_minutes: number,
  requireAvailability = false,
  ignoreSessionId?: string
) {
  const dayOfWeek = new Date(`${scheduled_date}T12:00:00`).getDay();
  if (Number.isNaN(dayOfWeek)) {
    return { ok: false, error: 'Invalid scheduled date' };
  }

  const requestedEnd = addMinutesToTime(scheduled_time, duration_minutes);
  if (requireAvailability) {
    const availSnap = await collections.practitionerAvailability()
      .where('practitioner_id', '==', practitioner_id)
      .where('day_of_week', '==', dayOfWeek)
      .get();

    const matchingAvailability = queryToArray(availSnap).some((av: any) =>
      scheduled_time >= av.start_time && requestedEnd <= av.end_time
    );

    if (!matchingAvailability) {
      return { ok: false, error: 'Selected slot does not match doctor availability' };
    }
  }

  const conflictSnap = await collections.therapySessions()
    .where('practitioner_id', '==', practitioner_id)
    .where('scheduled_date', '==', scheduled_date)
    .get();

  const activeConflicts = conflictSnap.docs.filter(d => {
    if (ignoreSessionId && d.id === ignoreSessionId) return false;
    return ['pending', 'scheduled', 'in-progress'].includes(d.data().status);
  });

  for (const cDoc of activeConflicts) {
    const c = cDoc.data();
    const conflictEnd = addMinutesToTime(c.scheduled_time, c.duration_minutes || 60);
    if (scheduled_time < conflictEnd && requestedEnd > c.scheduled_time) {
      return { ok: false, error: 'Scheduling conflict: practitioner is not available at this time' };
    }
  }

  return { ok: true };
}

// Get all sessions (with optional filters)
router.get('/', async (req: Request, res: Response) => {
  const { date, status, patient_id, practitioner_id } = req.query;
  let query: FirebaseFirestore.Query = collections.therapySessions();

  if (date) query = query.where('scheduled_date', '==', date);
  if (status) query = query.where('status', '==', status);
  if (patient_id) query = query.where('patient_id', '==', patient_id);
  if (practitioner_id) query = query.where('practitioner_id', '==', practitioner_id);

  const snap = await query.get();
  const sessions = queryToArray(snap).sort((a: any, b: any) => a.scheduled_date.localeCompare(b.scheduled_date) || a.scheduled_time.localeCompare(b.scheduled_time));

  for (const s of sessions) await enrichSession(s);
  res.json(sessions);
});

// Get session by ID
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.params.id || req.params.id.trim() === '') {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  const doc = await collections.therapySessions().doc(req.params.id).get();
  const session = docToObj(doc);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  await enrichSession(session);
  const ttDoc = await collections.therapyTypes().doc(session.therapy_type_id).get();
  session.therapy_description = ttDoc.exists ? ttDoc.data()?.description : '';
  const pDoc = await collections.patients().doc(session.patient_id).get();
  session.patient_phone = pDoc.exists ? pDoc.data()?.phone : '';
  session.patient_email = pDoc.exists ? pDoc.data()?.email : '';

  const fbSnap = await collections.patientFeedback()
    .where('session_id', '==', req.params.id).get();
  const feedback = queryToArray(fbSnap);

  res.json({ ...session, feedback });
});

// Create session — Patient books appointment (status: 'pending') 
router.post('/', async (req: Request, res: Response) => {
  const {
    treatment_plan_id, therapy_type_id, patient_id, practitioner_id,
    scheduled_date, scheduled_time, duration_minutes, is_ml_generated, auto_start_therapy
  } = req.body;

  if (!treatment_plan_id || !therapy_type_id || !patient_id || !practitioner_id || !scheduled_date || !scheduled_time) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  const ttDoc = await collections.therapyTypes().doc(therapy_type_id).get();
  const therapy = ttDoc.exists ? { id: ttDoc.id, ...ttDoc.data() } as any : null;
  const id = uuidv4();
  const finalDuration = duration_minutes || therapy?.duration_minutes || 60;
  const now = new Date().toISOString();

  const slotValidation = await validatePractitionerSlot(
    practitioner_id,
    scheduled_date,
    scheduled_time,
    finalDuration,
    Boolean(is_ml_generated)
  );
  if (!slotValidation.ok) {
    return res.status(409).json({ error: slotValidation.error });
  }

  // AI bookings are accepted automatically only after the slot matches doctor availability.
  const initialStatus = is_ml_generated
    ? (auto_start_therapy ? 'in-progress' : 'scheduled')
    : 'pending';

  await collections.therapySessions().doc(id).set({
    treatment_plan_id, therapy_type_id, patient_id, practitioner_id,
    scheduled_date, scheduled_time, duration_minutes: finalDuration,
    status: initialStatus, 
    requested_at: is_ml_generated ? null : now,  // Track when patient requested
    confirmed_at: is_ml_generated ? now : null,  // ML sessions are pre-confirmed
    actual_start_time: initialStatus === 'in-progress' ? now : null,
    actual_end_time: null,
    session_notes: null, progress_score: null, ai_confidence: null,
    created_at: now, updated_at: now,
    is_ml_generated: is_ml_generated || false,
  });

  // Only auto-create reminder notifications if scheduled (not pending)
  if (initialStatus === 'scheduled') {
    if (therapy?.pre_procedure_instructions) {
      await notifyPatient({
        patient_id, session_id: id, type: 'pre-procedure',
        title: `Pre-procedure: ${therapy.name}`,
        message: therapy.pre_procedure_instructions,
        scheduled_for: `${scheduled_date} ${scheduled_time}`,
      });
    }
    if (therapy?.post_procedure_instructions) {
      await notifyPatient({
        patient_id, session_id: id, type: 'post-procedure',
        title: `Post-procedure: ${therapy.name}`,
        message: therapy.post_procedure_instructions,
        scheduled_for: `${scheduled_date} ${scheduled_time}`,
      });
    }
  }

  if (initialStatus === 'in-progress') {
    const practitioner = docToObj(await collections.practitioners().doc(practitioner_id).get());
    await notifyPatient({
      patient_id, session_id: id, type: 'therapy_started',
      title: 'Therapy Session Started',
      message: `Your ${therapy?.name || 'therapy'} session with Dr. ${practitioner?.name || 'your practitioner'} has started.`,
      scheduled_for: `${scheduled_date} ${scheduled_time}`,
    });
  }

  const session = docToObj(await collections.therapySessions().doc(id).get());
  await enrichSession(session);
  
  // PHASE 1: Notify doctor of new pending appointment request
  if (initialStatus === 'pending') {
    const practitioner = docToObj(await collections.practitioners().doc(practitioner_id).get());
    const patient = docToObj(await collections.patients().doc(patient_id).get());
    emitDoctorAppointmentRequest(practitioner_id, {
      sessionId: id,
      patientName: patient?.name,
      doshaProfile: patient?.dosha_profile,
      requestedSlot: { date: scheduled_date, time: scheduled_time },
      therapyName: therapy?.name,
    });
  }

  emitSessionCreated(session);
  emitDashboardRefresh();
  res.status(201).json(session);
});

// Auto-schedule multiple sessions for a treatment plan
router.post('/auto-schedule', async (req: Request, res: Response) => {
  const { treatment_plan_id, therapy_type_id, patient_id, practitioner_id, start_date, num_sessions, frequency_days, preferred_time } = req.body;

  if (!treatment_plan_id || !therapy_type_id || !patient_id || !practitioner_id || !start_date || !num_sessions) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  const ttDoc = await collections.therapyTypes().doc(therapy_type_id).get();
  if (!ttDoc.exists) return res.status(404).json({ error: 'Therapy type not found' });
  const therapy = ttDoc.data() as any;

  const createdSessions: any[] = [];
  const freq = frequency_days || 1;
  const time = preferred_time || '09:00';

  for (let i = 0; i < num_sessions; i++) {
    const sessionDate = new Date(start_date);
    sessionDate.setDate(sessionDate.getDate() + (i * freq));
    const dateStr = sessionDate.toISOString().split('T')[0];

    const id = uuidv4();
    const now = new Date().toISOString();
    await collections.therapySessions().doc(id).set({
      treatment_plan_id, therapy_type_id, patient_id, practitioner_id,
      scheduled_date: dateStr, scheduled_time: time, duration_minutes: therapy.duration_minutes,
      status: 'scheduled', actual_start_time: null, actual_end_time: null,
      session_notes: null, progress_score: null, ai_confidence: null,
      created_at: now, updated_at: now,
    });

    // Auto-create notifications
    if (therapy.pre_procedure_instructions) {
      await collections.notifications().doc(uuidv4()).set({
        patient_id, session_id: id, type: 'pre-procedure', channel: 'in-app',
        title: `Pre-procedure: ${therapy.name}`, message: therapy.pre_procedure_instructions,
        is_read: 0, delivery_status: 'pending', scheduled_for: `${dateStr} ${time}`,
        sent_at: null, created_at: now,
      });
    }
    if (therapy.post_procedure_instructions) {
      await collections.notifications().doc(uuidv4()).set({
        patient_id, session_id: id, type: 'post-procedure', channel: 'in-app',
        title: `Post-procedure: ${therapy.name}`, message: therapy.post_procedure_instructions,
        is_read: 0, delivery_status: 'pending', scheduled_for: `${dateStr} ${time}`,
        sent_at: null, created_at: now,
      });
    }
    await collections.notifications().doc(uuidv4()).set({
      patient_id, session_id: id, type: 'reminder', channel: 'in-app',
      title: 'Upcoming Therapy Session',
      message: `You have a ${therapy.name} session at ${time} on ${dateStr}.`,
      is_read: 0, delivery_status: 'pending', scheduled_for: `${dateStr} ${time}`,
      sent_at: null, created_at: now,
    });

    createdSessions.push({ id, date: dateStr, time });
  }

  emitTherapyProgressRefresh(patient_id);
  res.status(201).json({ message: `${num_sessions} sessions scheduled`, sessions: createdSessions });
});

// Update session status
router.patch('/:id/status', async (req: Request, res: Response) => {
  if (!req.params.id || req.params.id.trim() === '') {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  const { status, session_notes, progress_score } = req.body;
  const validStatuses = ['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const doc = await collections.therapySessions().doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Session not found' });

  const updates: any = { status, updated_at: new Date().toISOString() };
  if (status === 'in-progress') updates.actual_start_time = new Date().toISOString();
  if (status === 'completed') updates.actual_end_time = new Date().toISOString();
  if (session_notes !== undefined) updates.session_notes = session_notes;
  if (progress_score !== undefined) updates.progress_score = progress_score;

  await collections.therapySessions().doc(req.params.id).update(updates);

  const session = docToObj(await collections.therapySessions().doc(req.params.id).get());

  // On session cancellation, notify & message patient with reason
  if (status === 'cancelled' && session.patient_id) {
    try {
      const practitionerDoc = await collections.practitioners().doc(session.practitioner_id).get();
      const practitionerName = practitionerDoc.exists ? practitionerDoc.data()?.name : 'the clinic';
      const reason = session_notes || 'No specific reason provided';
      const patientMsg = `Your ${session.therapy_name || 'therapy'} session scheduled on ${session.scheduled_date} at ${session.scheduled_time} has been cancelled.\n\nReason: ${reason}\n\nPlease contact ${practitionerName} if you have any questions.`;
      const doctorMsg = `${session.patient_name || 'Patient'}'s ${session.therapy_name || 'therapy'} session on ${session.scheduled_date} at ${session.scheduled_time} has been cancelled.\n\nReason: ${reason}`;

      await notifyPatient({
        patient_id: session.patient_id,
        session_id: req.params.id,
        type: 'alert',
        title: 'Therapy Session Cancelled',
        message: patientMsg,
      });
      await notifyDoctors({
        title: 'Session Cancelled',
        message: doctorMsg,
        session_id: req.params.id,
        type: 'alert',
      });

      await sendSessionMessage(
        session,
        session.practitioner_id,
        session.patient_id,
        patientMsg,
        'system_cancellation'
      );
    } catch (notifErr) {
      console.warn('[Sessions] Could not send cancellation notification:', notifErr);
    }
  }

  // On session completion, send post-procedure follow-up notification and message
  if (status === 'completed' && session.patient_id && session.therapy_type_id) {
    try {
      const ttDoc = await collections.therapyTypes().doc(session.therapy_type_id).get();
      const therapy = ttDoc.exists ? ttDoc.data() : null;
      const prDoc = await collections.practitioners().doc(session.practitioner_id).get();
      const practitionerName = prDoc.exists ? prDoc.data()?.name : 'your practitioner';

      if (therapy?.post_procedure_instructions) {
        await notifyPatient({
          patient_id: session.patient_id,
          session_id: req.params.id,
          type: 'post-procedure',
          title: `Post-procedure care: ${therapy.name}`,
          message: `Your ${therapy.name} session with Dr. ${practitionerName} is complete.\n\nIMPORTANT POST-PROCEDURE PRECAUTIONS:\n${therapy.post_procedure_instructions}`,
        });
      }

      // Always send a completion notification
      await notifyPatient({
        patient_id: session.patient_id,
        session_id: req.params.id,
        type: 'reminder',
        title: `Session Complete — ${therapy?.name || 'Therapy'}`,
        message: `Your therapy session with Dr. ${practitionerName} has been completed. Please submit your feedback to help us track your progress.`,
      });
      await notifyDoctors({
        title: `Session Complete — ${therapy?.name || 'Therapy'}`,
        message: `${session.patient_name || 'Patient'}'s ${therapy?.name || 'therapy'} session with you has been marked complete.${session_notes ? `\n\nNotes: ${session_notes}` : ''}`,
        session_id: req.params.id,
        type: 'reminder',
      });

      const notes = session_notes ? `\n\nSession notes: ${session_notes}` : '';
      await sendSessionMessage(
        session,
        session.practitioner_id,
        session.patient_id,
        `Your ${therapy?.name || 'therapy'} session with Dr. ${practitionerName} has been marked complete.${notes}`,
        'system_completion'
      );
    } catch (notifErr) {
      console.warn('[Sessions] Could not send completion notifications:', notifErr);
    }
  }

  emitSessionUpdate(session);
  emitDashboardRefresh();
  res.json(session);
});

/**
 * PATCH /sessions/:id/start - Doctor initiates therapy session
 * Therapy can only start after acceptance. This endpoint marks the actual start.
 */
router.patch('/:id/start', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId || sessionId.trim() === '') {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    const { session_notes } = req.body;

    const doc = await collections.therapySessions().doc(sessionId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Therapy session not found' });
    }

    const session = doc.data() as any;

    // Only allow starting if session is in 'scheduled' status
    if (session.status !== 'scheduled') {
      return res.status(400).json({ 
        error: `Cannot start therapy session with status: ${session.status}. Only 'scheduled' sessions can be started.` 
      });
    }

    const now = new Date().toISOString();

    // Update session to 'in-progress' with actual start time
    await collections.therapySessions().doc(sessionId).update({
      status: 'in-progress',
      actual_start_time: now,
      updated_at: now,
      ...(session_notes && { session_notes }),
    });

    const updatedSession = docToObj(await collections.therapySessions().doc(sessionId).get());
    await enrichSession(updatedSession);

    // Get patient and practitioner info for notification
    const patientDoc = await collections.patients().doc(session.patient_id).get();
    const practitionerDoc = await collections.practitioners().doc(session.practitioner_id).get();
    const therapyTypeDoc = session.therapy_type_id ? await collections.therapyTypes().doc(session.therapy_type_id).get() : null;

    const patientName = patientDoc.data()?.name || 'Patient';
    const practitionerName = practitionerDoc.data()?.name || 'Doctor';
    const therapyName = therapyTypeDoc?.data()?.name || updatedSession.therapy_name || 'Therapy';

    // Notify patient and doctor that therapy has started
    try {
      await notifyPatient({
        patient_id: session.patient_id,
        session_id: sessionId,
        type: 'therapy_started',
        title: 'Therapy Session Started',
        message: `Your ${therapyName} therapy session with Dr. ${practitionerName} has started. Please follow the guidance provided.`,
      });
      await notifyDoctors({
        title: 'Therapy Session Started',
        message: `${therapyName} therapy for ${patientName} has started.`,
        session_id: sessionId,
        type: 'therapy_started',
      });
    } catch (notifError) {
      console.warn('[Sessions] Could not send start notification:', notifError);
    }

    // Emit real-time update to patient that therapy is now in progress
    emitSessionUpdate(updatedSession);
    emitTherapyProgressRefresh(session.patient_id);
    emitDashboardRefresh();

    res.json({
      session: updatedSession,
      message: `${therapyName} therapy started successfully for ${patientName}`,
    });
  } catch (error: any) {
    console.error('[Sessions] Error starting therapy session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reschedule session
router.patch('/:id/reschedule', async (req: Request, res: Response) => {
  if (!req.params.id || req.params.id.trim() === '') {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  const { scheduled_date, scheduled_time } = req.body;
  if (!scheduled_date || !scheduled_time) {
    return res.status(400).json({ error: 'New date and time are required' });
  }

  const doc = await collections.therapySessions().doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Session not found' });
  const existing = doc.data() as any;

  await collections.therapySessions().doc(req.params.id).update({
    scheduled_date, scheduled_time, updated_at: new Date().toISOString(),
  });

  // Create reschedule notification
  await collections.notifications().doc(uuidv4()).set({
    patient_id: existing.patient_id, session_id: req.params.id,
    type: 'reschedule', channel: 'in-app',
    title: 'Session Rescheduled',
    message: `Your therapy session has been rescheduled to ${scheduled_date} at ${scheduled_time}.`,
    is_read: 0, delivery_status: 'pending', scheduled_for: new Date().toISOString(),
    sent_at: null, created_at: new Date().toISOString(),
  });

  const session = docToObj(await collections.therapySessions().doc(req.params.id).get());
  emitTherapyProgressRefresh(existing.patient_id);
  res.json(session);
});

// PHASE 1: Doctor approves a pending appointment request
router.put('/:id/approve', async (req: Request, res: Response) => {
  const { approval_notes } = req.body;
  const sessionId = req.params.id;
  if (!sessionId || sessionId.trim() === '') {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const doc = await collections.therapySessions().doc(sessionId).get();
  if (!doc.exists) return res.status(404).json({ error: 'Session not found' });

  const session = doc.data() as any;
  if (session.status !== 'pending') {
    return res.status(400).json({ error: `Cannot approve a session with status '${session.status}'` });
  }

  const now = new Date().toISOString();

  // PHASE 2: Check if treatment plan exists, create if not
  let treatmentPlanId = session.treatment_plan_id;
  const planDoc = await collections.treatmentPlans().doc(treatmentPlanId).get();
  
  if (!planDoc.exists) {
    // Create new treatment plan anchored to this appointment
    treatmentPlanId = uuidv4();
    await collections.treatmentPlans().doc(treatmentPlanId).set({
      patient_id: session.patient_id,
      practitioner_id: session.practitioner_id,
      start_date: session.scheduled_date,  // KEY: anchored to approved appointment date
      status: 'active',
      therapy_sequence: [],
      created_at: now,
      updated_at: now,
    });
  } else {
    // Update existing plan to active if it's draft
    const plan = planDoc.data() as any;
    if (plan.status === 'draft') {
      await collections.treatmentPlans().doc(treatmentPlanId).update({
        status: 'active',
        start_date: session.scheduled_date,
        updated_at: now,
      });
    }
  }

  // Update session to 'scheduled' and mark as confirmed
  await collections.therapySessions().doc(sessionId).update({
    status: 'scheduled',
    confirmed_at: now,
    treatment_plan_id: treatmentPlanId,
    approval_notes,
    updated_at: now,
  });

  // Send pre/post-procedure precaution notifications for the approved session
  try {
    const ttDoc = await collections.therapyTypes().doc(session.therapy_type_id).get();
    const therapy = ttDoc.exists ? ttDoc.data() : null;
    if (therapy?.pre_procedure_instructions) {
      await notifyPatient({
        patient_id: session.patient_id,
        session_id: sessionId,
        type: 'pre-procedure',
        title: `⚠️ Pre-procedure precautions: ${therapy.name}`,
        message: `Your ${therapy.name} appointment on ${session.scheduled_date} at ${session.scheduled_time} has been confirmed.\n\nPLEASE FOLLOW THESE PRE-PROCEDURE PRECAUTIONS:\n${therapy.pre_procedure_instructions}`,
        scheduled_for: `${session.scheduled_date} ${session.scheduled_time}`,
      });
    }
    if (therapy?.post_procedure_instructions) {
      await notifyPatient({
        patient_id: session.patient_id,
        session_id: sessionId,
        type: 'post-procedure',
        title: `Post-procedure care: ${therapy.name}`,
        message: `After your ${therapy.name} session, please follow these post-procedure precautions:\n${therapy.post_procedure_instructions}`,
        scheduled_for: `${session.scheduled_date} ${session.scheduled_time}`,
      });
    }
  } catch (precautionErr) {
    console.warn('[Sessions] Could not send precaution notifications:', precautionErr);
  }

  const updatedSession = docToObj(await collections.therapySessions().doc(sessionId).get());
  
  // PHASE 3: Trigger ML to sequence future sessions
  try {
    const patient = docToObj(await collections.patients().doc(session.patient_id).get());
    const therapyTypes = await collections.therapyTypes().get();
    const therapyList = therapyTypes.docs.map(d => d.data().name);

    const mlResponse = await fetch(`${process.env.ML_SERVICE_URL || 'http://localhost:5000'}/api/ai/schedule/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: session.patient_id,
        plan_id: treatmentPlanId,
        start_date: session.scheduled_date,
        treatment_duration_days: 21,
        therapies: therapyList.slice(0, 3),
      }),
    });

    if (mlResponse.ok) {
      const mlResult = await mlResponse.json();
      
      // Batch write the sequenced sessions
      const batch = db.batch();
      (mlResult.suggested_sessions || []).forEach((mlSession: any) => {
        const newSessionId = uuidv4();
        const newSessionRef = collections.therapySessions().doc(newSessionId);
        
        batch.set(newSessionRef, {
          treatment_plan_id: treatmentPlanId,
          therapy_type_id: mlSession.therapy_name, // Use as reference
          patient_id: session.patient_id,
          practitioner_id: session.practitioner_id,
          scheduled_date: mlSession.suggested_date.split('T')[0],
          scheduled_time: mlSession.suggested_date.split('T')[1]?.substring(0, 5) || '09:00',
          duration_minutes: mlSession.duration_minutes || 120,
          status: 'scheduled',
          confirmed_at: now,
          requested_at: null,
          is_ml_generated: true,
          created_at: now,
          updated_at: now,
        });
      });
      await batch.commit();

      // PHASE 5: Notify patient of approved appointment and treatment plan
      const practitioner = docToObj(await collections.practitioners().doc(session.practitioner_id).get());
      await notifyPatient({
        patient_id: session.patient_id,
        session_id: sessionId,
        type: 'appointment_confirmed',
        title: 'Appointment Confirmed!',
        message: `Your appointment with Dr. ${practitioner?.name} on ${session.scheduled_date} is confirmed. Your Panchakarma course begins then.`,
        scheduled_for: `${session.scheduled_date} ${session.scheduled_time}`,
      });

      await notifyPatient({
        patient_id: session.patient_id,
        type: 'treatment_plan_created',
        title: 'Treatment Plan Ready',
        message: `Your personalized treatment plan with ${mlResult.suggested_sessions?.length || 0} sessions is ready. Check your portal for details.`,
      });

      // Emit real-time events
      emitTreatmentPlanCreated(session.patient_id, {
        planId: treatmentPlanId,
        startDate: session.scheduled_date,
        sessionCount: mlResult.suggested_sessions?.length || 0,
        firstTherapy: mlResult.suggested_sessions?.[0]?.therapy_name,
      });
    }
  } catch (mlError) {
    console.error('ML sequencing failed:', mlError);
    // Don't fail the approval if ML fails - allow manual scheduling later
  }

  emitSessionUpdate(updatedSession);
  emitDashboardRefresh();
  res.json(updatedSession);
});

// PHASE 1: Doctor rejects a pending appointment request
router.put('/:id/reject', async (req: Request, res: Response) => {
  const { rejection_reason } = req.body;
  const sessionId = req.params.id;
  if (!sessionId || sessionId.trim() === '') {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  if (!rejection_reason) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  const doc = await collections.therapySessions().doc(sessionId).get();
  if (!doc.exists) return res.status(404).json({ error: 'Session not found' });

  const session = doc.data() as any;
  if (session.status !== 'pending') {
    return res.status(400).json({ error: `Cannot reject a session with status '${session.status}'` });
  }

  const now = new Date().toISOString();

  // Update session to 'cancelled' with rejection reason
  await collections.therapySessions().doc(sessionId).update({
    status: 'cancelled',
    rejection_reason,
    rejected_at: now,
    updated_at: now,
  });

  const updatedSession = docToObj(await collections.therapySessions().doc(sessionId).get());

  // Notify patient of rejection
  const practitioner = docToObj(await collections.practitioners().doc(session.practitioner_id).get());
  await notifyPatient({
    patient_id: session.patient_id,
    session_id: sessionId,
    type: 'appointment_rejected',
    title: 'Appointment Request Not Approved',
    message: `Dr. ${practitioner?.name} could not approve your requested appointment. Reason: ${rejection_reason}. Please book another slot or contact the clinic.`,
  });

  emitSessionUpdate(updatedSession);
  emitDashboardRefresh();
  res.json({ status: 'rejected', session: updatedSession });
});

// Get pending appointments for a doctor
router.get('/doctor/:practitioner_id/pending', async (req: Request, res: Response) => {
  const snap = await collections.therapySessions()
    .where('practitioner_id', '==', req.params.practitioner_id)
    .where('status', '==', 'pending')
    .get();

  const sessions = queryToArray(snap).sort((a: any, b: any) => 
    new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
  );

  for (const s of sessions) await enrichSession(s);
  res.json(sessions);
});

/**
 * DELETE /sessions/clear - Clear session history
 */
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    const { practitioner_id, patient_id } = req.query;
    let query: FirebaseFirestore.Query = collections.therapySessions();
    if (practitioner_id) query = query.where('practitioner_id', '==', practitioner_id as string);
    if (patient_id) query = query.where('patient_id', '==', patient_id as string);

    const snap = await query.get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    emitDashboardRefresh();
    res.json({ message: 'Session history cleared', count: snap.size });
  } catch (error: any) {
    console.error('[Sessions] Error clearing sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
