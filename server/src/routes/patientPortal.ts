import { Router, Response } from 'express';
import { collections, queryToArray } from '../models/database';
import { verifyPatientToken, AuthRequest } from '../middleware/auth';

const router = Router();

function isDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function enrichSession(s: any) {
  const [ttDoc, pDoc, prDoc] = await Promise.all([
    isDocumentId(s.therapy_type_id)
      ? collections.therapyTypes().doc(s.therapy_type_id).get()
      : null,
    isDocumentId(s.patient_id)
      ? collections.patients().doc(s.patient_id).get()
      : null,
    isDocumentId(s.practitioner_id)
      ? collections.practitioners().doc(s.practitioner_id).get()
      : null,
  ]);

  s.therapy_name = ttDoc?.exists ? ttDoc.data()?.name : s.therapy_name || '';
  s.category = ttDoc?.exists ? ttDoc.data()?.category : s.category || '';
  s.patient_name = pDoc?.exists ? pDoc.data()?.name : s.patient_name || '';
  s.practitioner_name = prDoc?.exists ? prDoc.data()?.name : s.practitioner_name || '';
  s.pre_procedure_instructions = ttDoc?.exists
    ? ttDoc.data()?.pre_procedure_instructions
    : s.pre_procedure_instructions || '';
  s.post_procedure_instructions = ttDoc?.exists
    ? ttDoc.data()?.post_procedure_instructions
    : s.post_procedure_instructions || '';
  return s;
}

/** Authenticated: same sessions / plans / milestones your doctors see for you — scoped to JWT patient id */
router.get('/therapy-progress', verifyPatientToken, async (req: AuthRequest, res: Response) => {
  const patientId = req.patient!.id;

  const sessSnap = await collections.therapySessions().where('patient_id', '==', patientId).get();
  const sessions = queryToArray(sessSnap).sort(
    (a: any, b: any) =>
      String(a.scheduled_date || '').localeCompare(String(b.scheduled_date || '')) ||
      String(a.scheduled_time || '').localeCompare(String(b.scheduled_time || ''))
  );
  await Promise.all(sessions.map(enrichSession));

  const planSnap = await collections.treatmentPlans().where('patient_id', '==', patientId).get();
  const plans = queryToArray(planSnap).sort((a: any, b: any) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  );
  for (const plan of plans) {
    const prDoc = isDocumentId(plan.practitioner_id)
      ? await collections.practitioners().doc(plan.practitioner_id).get()
      : null;
    plan.practitioner_name = prDoc?.exists ? prDoc.data()?.name : plan.practitioner_name || '';
    plan.patient_name = req.patient!.name;
  }

  const milSnap = await collections.recoveryMilestones().where('patient_id', '==', patientId).get();
  const milestones = queryToArray(milSnap).sort((a: any, b: any) =>
    String(a.target_date || '').localeCompare(String(b.target_date || ''))
  );
  for (const m of milestones) {
    const tpDoc = isDocumentId(m.treatment_plan_id)
      ? await collections.treatmentPlans().doc(m.treatment_plan_id).get()
      : null;
    m.plan_name = tpDoc?.exists ? tpDoc.data()?.plan_name : m.plan_name || '';
  }

  res.json({ sessions, plans, milestones });
});

export default router;
