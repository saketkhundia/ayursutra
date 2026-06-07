import { Router, Response } from 'express';
import { collections, queryToArray } from '../models/database';
import { verifyPatientToken, AuthRequest } from '../middleware/auth';

const router = Router();

async function enrichSession(s: any) {
  const ttDoc = await collections.therapyTypes().doc(s.therapy_type_id).get();
  const pDoc = await collections.patients().doc(s.patient_id).get();
  const prDoc = await collections.practitioners().doc(s.practitioner_id).get();
  s.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
  s.category = ttDoc.exists ? ttDoc.data()?.category : '';
  s.patient_name = pDoc.exists ? pDoc.data()?.name : '';
  s.practitioner_name = prDoc.exists ? prDoc.data()?.name : '';
  s.pre_procedure_instructions = ttDoc.exists ? ttDoc.data()?.pre_procedure_instructions : '';
  s.post_procedure_instructions = ttDoc.exists ? ttDoc.data()?.post_procedure_instructions : '';
  return s;
}

/** Authenticated: same sessions / plans / milestones your doctors see for you — scoped to JWT patient id */
router.get('/therapy-progress', verifyPatientToken, async (req: AuthRequest, res: Response) => {
  const patientId = req.patient!.id;

  const sessSnap = await collections.therapySessions().where('patient_id', '==', patientId).get();
  const sessions = queryToArray(sessSnap).sort(
    (a: any, b: any) =>
      a.scheduled_date.localeCompare(b.scheduled_date) || a.scheduled_time.localeCompare(b.scheduled_time)
  );
  for (const s of sessions) await enrichSession(s);

  const planSnap = await collections.treatmentPlans().where('patient_id', '==', patientId).get();
  const plans = queryToArray(planSnap).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
  for (const plan of plans) {
    const prDoc = await collections.practitioners().doc(plan.practitioner_id).get();
    plan.practitioner_name = prDoc.exists ? prDoc.data()?.name : '';
    plan.patient_name = req.patient!.name;
  }

  const milSnap = await collections.recoveryMilestones().where('patient_id', '==', patientId).get();
  const milestones = queryToArray(milSnap).sort((a: any, b: any) => (a.target_date || '').localeCompare(b.target_date || ''));
  for (const m of milestones) {
    const tpDoc = await collections.treatmentPlans().doc(m.treatment_plan_id).get();
    m.plan_name = tpDoc.exists ? tpDoc.data()?.plan_name : '';
  }

  res.json({ sessions, plans, milestones });
});

export default router;
