import { Router, Request, Response } from 'express';
import { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { emitTherapyProgressRefresh } from '../services/realtime';

const router = Router();

// Get milestones for a treatment plan
router.get('/plan/:plan_id', async (req: Request, res: Response) => {
  const snap = await collections.recoveryMilestones()
    .where('treatment_plan_id', '==', req.params.plan_id)
    .get();
  const milestones = queryToArray(snap).sort((a: any, b: any) => a.target_date.localeCompare(b.target_date));
  res.json(milestones);
});

// Get milestones for a patient
router.get('/patient/:patient_id', async (req: Request, res: Response) => {
  const snap = await collections.recoveryMilestones()
    .where('patient_id', '==', req.params.patient_id)
    .get();
  const milestones = queryToArray(snap).sort((a: any, b: any) => a.target_date.localeCompare(b.target_date));

  for (const m of milestones) {
    const tpDoc = await collections.treatmentPlans().doc(m.treatment_plan_id).get();
    m.plan_name = tpDoc.exists ? tpDoc.data()?.plan_name : '';
  }

  res.json(milestones);
});

// Create milestone
router.post('/', async (req: Request, res: Response) => {
  const { treatment_plan_id, patient_id, milestone_name, description, target_date } = req.body;
  if (!treatment_plan_id || !patient_id || !milestone_name) {
    return res.status(400).json({ error: 'treatment_plan_id, patient_id, and milestone_name are required' });
  }

  const id = uuidv4();
  await collections.recoveryMilestones().doc(id).set({
    treatment_plan_id, patient_id, milestone_name,
    description: description || null, target_date: target_date || null,
    achieved_date: null, status: 'pending',
    created_at: new Date().toISOString(),
  });

  const milestone = docToObj(await collections.recoveryMilestones().doc(id).get());
  emitTherapyProgressRefresh(patient_id);
  res.status(201).json(milestone);
});

// Update milestone status
router.patch('/:id', async (req: Request, res: Response) => {
  const { status, achieved_date } = req.body;
  const doc = await collections.recoveryMilestones().doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Milestone not found' });
  const existing = doc.data() as any;

  if (status === 'achieved') {
    await collections.recoveryMilestones().doc(req.params.id).update({
      status: 'achieved',
      achieved_date: achieved_date || new Date().toISOString().split('T')[0],
    });

    // Notify patient about milestone achievement
    const now = new Date().toISOString();
    await collections.notifications().doc(uuidv4()).set({
      patient_id: existing.patient_id, session_id: null,
      type: 'milestone', channel: 'in-app',
      title: 'Milestone Achieved!',
      message: `Congratulations! You've achieved: "${existing.milestone_name}". Keep up the great progress!`,
      is_read: 0, delivery_status: 'pending',
      scheduled_for: now, sent_at: null, created_at: now,
    });
  } else {
    await collections.recoveryMilestones().doc(req.params.id).update({ status });
  }

  const milestone = docToObj(await collections.recoveryMilestones().doc(req.params.id).get());
  emitTherapyProgressRefresh(existing.patient_id);
  res.json(milestone);
});

export default router;
