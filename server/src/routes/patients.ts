import { Router, Response } from 'express';
import { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { verifyDoctorToken, AuthRequest } from '../middleware/auth';

const router = Router();

// All patient routes require doctor authentication
router.use(verifyDoctorToken);

// Get all patients for the authenticated doctor
router.get('/', async (req: AuthRequest, res: Response) => {
  const snap = await collections.patients()
    .where('practitioner_id', '==', req.doctor!.id)
    .get();
  const patients = queryToArray(snap).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
  res.json(patients);
});

// Get patient by ID (must belong to this doctor)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const doc = await collections.patients().doc(req.params.id as string).get();
  const patient = docToObj(doc);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  if (patient.practitioner_id !== req.doctor!.id) return res.status(403).json({ error: 'Not your patient' });
  res.json(patient);
});

// Create patient
router.post('/', async (req: AuthRequest, res: Response) => {
  const {
    name, age, gender, phone, email, address,
    medical_history, prakriti, current_dosha_imbalance, allergies
  } = req.body;

  if (!name || !age || !gender) {
    return res.status(400).json({ error: 'Name, age, and gender are required' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  await collections.patients().doc(id).set({
    name, age, gender,
    phone: phone || null, email: email || null, address: address || null,
    medical_history: medical_history || null, prakriti: prakriti || null,
    current_dosha_imbalance: current_dosha_imbalance || null, allergies: allergies || null,
    practitioner_id: req.doctor!.id,
    created_at: now, updated_at: now,
  });

  // Create default notification preferences
  await collections.notificationPreferences().doc(uuidv4()).set({
    patient_id: id, in_app: 1, sms: 0, email: 1, push: 0, reminder_hours_before: 24,
  });

  const patient = docToObj(await collections.patients().doc(id).get());
  res.status(201).json(patient);
});

// Update patient (must belong to this doctor)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const {
    name, age, gender, phone, email, address,
    medical_history, prakriti, current_dosha_imbalance, allergies
  } = req.body;

  const doc = await collections.patients().doc(req.params.id as string).get();
  if (!doc.exists) return res.status(404).json({ error: 'Patient not found' });
  const existing = doc.data();
  if (existing?.practitioner_id !== req.doctor!.id) return res.status(403).json({ error: 'Not your patient' });

  await collections.patients().doc(req.params.id as string).update({
    name, age, gender, phone, email, address,
    medical_history, prakriti, current_dosha_imbalance, allergies,
    updated_at: new Date().toISOString(),
  });

  const patient = docToObj(await collections.patients().doc(req.params.id as string).get());
  res.json(patient);
});

// Delete patient (must belong to this doctor)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const doc = await collections.patients().doc(req.params.id as string).get();
  if (!doc.exists) return res.status(404).json({ error: 'Patient not found' });
  const existing = doc.data();
  if (existing?.practitioner_id !== req.doctor!.id) return res.status(403).json({ error: 'Not your patient' });

  await collections.patients().doc(req.params.id as string).delete();
  res.json({ message: 'Patient deleted successfully' });
});

// Get patient's treatment history with sessions
router.get('/:id/history', async (req: AuthRequest, res: Response) => {
  const plansSnap = await collections.treatmentPlans()
    .where('patient_id', '==', req.params.id as string).get();
  const plans = queryToArray(plansSnap).sort((a: any, b: any) => b.start_date.localeCompare(a.start_date));

  // Enrich with practitioner names
  for (const plan of plans) {
    const prDoc = await collections.practitioners().doc(plan.practitioner_id).get();
    plan.practitioner_name = prDoc.exists ? prDoc.data()?.name : '';
  }

  const sessionsSnap = await collections.therapySessions()
    .where('patient_id', '==', req.params.id as string).get();
  const sessions = queryToArray(sessionsSnap).sort((a: any, b: any) => b.scheduled_date.localeCompare(a.scheduled_date));

  // Enrich with therapy names
  for (const s of sessions) {
    const ttDoc = await collections.therapyTypes().doc(s.therapy_type_id).get();
    s.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
    s.category = ttDoc.exists ? ttDoc.data()?.category : '';
  }

  res.json({ plans, sessions });
});

export default router;
