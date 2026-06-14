import { Router, Request, Response } from 'express';
import db, { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { notifyPatient, notifyDoctors } from '../services/notification-service';
import { emitTherapyProgressRefresh } from '../services/realtime';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const snap = await collections.treatmentPlans().get();
  const plans = queryToArray(snap).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));

  for (const plan of plans) {
    const pDoc = await collections.patients().doc(plan.patient_id).get();
    const prDoc = await collections.practitioners().doc(plan.practitioner_id).get();
    plan.patient_name = pDoc.exists ? pDoc.data()?.name : '';
    plan.practitioner_name = prDoc.exists ? prDoc.data()?.name : '';
  }

  res.json(plans);
});

router.get('/:id', async (req: Request, res: Response) => {
  const doc = await collections.treatmentPlans().doc(req.params.id as string).get();
  const plan = docToObj(doc);
  if (!plan) return res.status(404).json({ error: 'Treatment plan not found' });

  const pDoc = await collections.patients().doc(plan.patient_id).get();
  const prDoc = await collections.practitioners().doc(plan.practitioner_id).get();
  plan.patient_name = pDoc.exists ? pDoc.data()?.name : '';
  plan.practitioner_name = prDoc.exists ? prDoc.data()?.name : '';

  const sessSnap = await collections.therapySessions()
    .where('treatment_plan_id', '==', req.params.id as string).get();
  const sessions = queryToArray(sessSnap).sort((a: any, b: any) => a.scheduled_date.localeCompare(b.scheduled_date) || a.scheduled_time.localeCompare(b.scheduled_time));
  for (const s of sessions) {
    const ttDoc = await collections.therapyTypes().doc(s.therapy_type_id).get();
    s.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
    s.category = ttDoc.exists ? ttDoc.data()?.category : '';
  }

  const milSnap = await collections.recoveryMilestones()
    .where('treatment_plan_id', '==', req.params.id as string).get();
  const milestones = queryToArray(milSnap).sort((a: any, b: any) => (a.target_date || '').localeCompare(b.target_date || ''));

  res.json({ ...plan, sessions, milestones });
});

router.post('/', async (req: Request, res: Response) => {
  const { patient_id, practitioner_id, diagnosis, plan_name, start_date, end_date, notes } = req.body;

  if (!patient_id || !practitioner_id || !diagnosis || !plan_name || !start_date || !end_date) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  await collections.treatmentPlans().doc(id).set({
    patient_id, practitioner_id, diagnosis, plan_name,
    start_date, end_date, status: 'active', notes: notes || null,
    created_at: now, updated_at: now,
  });

  const plan = docToObj(await collections.treatmentPlans().doc(id).get());
  const pDoc = await collections.patients().doc(patient_id).get();
  const prDoc = await collections.practitioners().doc(practitioner_id).get();
  plan.patient_name = pDoc.exists ? pDoc.data()?.name : '';
  plan.practitioner_name = prDoc.exists ? prDoc.data()?.name : '';

  emitTherapyProgressRefresh(patient_id);
  res.status(201).json(plan);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { diagnosis, plan_name, start_date, end_date, status, notes } = req.body;

  const doc = await collections.treatmentPlans().doc(req.params.id as string).get();
  if (!doc.exists) return res.status(404).json({ error: 'Treatment plan not found' });

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (diagnosis !== undefined) updates.diagnosis = diagnosis;
  if (plan_name !== undefined) updates.plan_name = plan_name;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  await collections.treatmentPlans().doc(req.params.id as string).update(updates);

  const plan = docToObj(await collections.treatmentPlans().doc(req.params.id as string).get());

  // Notify patient when plan is cancelled
  if (status === 'cancelled' && plan.patient_id) {
    try {
      const prDoc = await collections.practitioners().doc(plan.practitioner_id).get();
      const practitionerName = prDoc.exists ? prDoc.data()?.name : 'your doctor';
      await notifyPatient({
        patient_id: plan.patient_id,
        type: 'alert',
        title: 'Treatment Plan Cancelled',
        message: `Your treatment plan "${plan.plan_name}" has been cancelled by Dr. ${practitionerName}.\n\nReason: ${notes || 'No reason provided'}`,
      });
      await notifyDoctors({
        title: 'Treatment Plan Cancelled',
        message: `Treatment plan "${plan.plan_name}" for ${plan.patient_name || 'patient'} has been cancelled.\n\nReason: ${notes || 'No reason provided'}`,
      });
    } catch (notifErr) {
      console.warn('[TreatmentPlans] Could not send cancellation notification:', notifErr);
    }
  }

  emitTherapyProgressRefresh(plan.patient_id);
  res.json(plan);
});

export default router;
