import { Router, Request, Response } from 'express';
import { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get feedback for a session
router.get('/session/:session_id', async (req: Request, res: Response) => {
  const snap = await collections.patientFeedback()
    .where('session_id', '==', req.params.session_id)
    .get();
  const feedback = queryToArray(snap).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));

  for (const f of feedback) {
    const pDoc = await collections.patients().doc(f.patient_id).get();
    f.patient_name = pDoc.exists ? pDoc.data()?.name : '';
  }

  res.json(feedback);
});

// Get all feedback for a patient
router.get('/patient/:patient_id', async (req: Request, res: Response) => {
  const snap = await collections.patientFeedback()
    .where('patient_id', '==', req.params.patient_id)
    .get();
  const feedback = queryToArray(snap);

  for (const f of feedback) {
    const sDoc = await collections.therapySessions().doc(f.session_id).get();
    if (sDoc.exists) {
      f.scheduled_date = sDoc.data()?.scheduled_date;
      const ttDoc = await collections.therapyTypes().doc(sDoc.data()?.therapy_type_id).get();
      f.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
    }
  }

  res.json(feedback);
});

// Submit feedback
router.post('/', async (req: Request, res: Response) => {
  const {
    session_id, patient_id, overall_rating, pain_level, energy_level,
    sleep_quality, digestion_rating, symptoms_reported, side_effects,
    improvements, additional_notes
  } = req.body;

  if (!session_id || !patient_id || !overall_rating) {
    return res.status(400).json({ error: 'session_id, patient_id, and overall_rating are required' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  await collections.patientFeedback().doc(id).set({
    session_id, patient_id, overall_rating,
    pain_level: pain_level || null, energy_level: energy_level || null,
    sleep_quality: sleep_quality || null, digestion_rating: digestion_rating || null,
    symptoms_reported: symptoms_reported || null, side_effects: side_effects || null,
    improvements: improvements || null, additional_notes: additional_notes || null,
    created_at: now,
  });

  // If patient reports side effects, create a notification for follow-up
  if (side_effects) {
    const sDoc = await collections.therapySessions().doc(session_id).get();
    if (sDoc.exists) {
      const sData = sDoc.data() as any;
      const ttDoc = await collections.therapyTypes().doc(sData.therapy_type_id).get();
      const therapyName = ttDoc.exists ? ttDoc.data()?.name : 'therapy';

      await collections.notifications().doc(uuidv4()).set({
        patient_id, session_id, type: 'alert', channel: 'in-app',
        title: 'Side Effects Reported - Follow Up Needed',
        message: `Patient reported side effects after ${therapyName}: ${side_effects}. Please review and adjust treatment if needed.`,
        is_read: 0, delivery_status: 'pending',
        scheduled_for: now, sent_at: null, created_at: now,
      });
    }
  }

  const feedback = docToObj(await collections.patientFeedback().doc(id).get());
  res.status(201).json(feedback);
});

// Get progress trends for a patient (for visualization)
router.get('/trends/:patient_id', async (req: Request, res: Response) => {
  const snap = await collections.patientFeedback()
    .where('patient_id', '==', req.params.patient_id).get();
  const feedback = queryToArray(snap);

  // Enrich and sort by scheduled_date
  for (const f of feedback) {
    const sDoc = await collections.therapySessions().doc(f.session_id).get();
    if (sDoc.exists) {
      f.scheduled_date = sDoc.data()?.scheduled_date;
      const ttDoc = await collections.therapyTypes().doc(sDoc.data()?.therapy_type_id).get();
      f.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
    }
  }

  feedback.sort((a: any, b: any) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''));

  const trends = feedback.map((f: any) => ({
    overall_rating: f.overall_rating,
    pain_level: f.pain_level,
    energy_level: f.energy_level,
    sleep_quality: f.sleep_quality,
    digestion_rating: f.digestion_rating,
    scheduled_date: f.scheduled_date,
    therapy_name: f.therapy_name,
  }));

  res.json(trends);
});

export default router;
