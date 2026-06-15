import { Router, Response } from 'express';
import { collections, queryToArray } from '../models/database';
import { verifyDoctorToken, AuthRequest } from '../middleware/auth';

const router = Router();

// All dashboard routes require doctor authentication
router.use(verifyDoctorToken);

router.get('/stats', async (req: AuthRequest, res: Response) => {
  const doctorId = req.doctor!.id;

  const patientsSnap = await collections.patients()
    .where('practitioner_id', '==', doctorId).get();
  const totalPatients = patientsSnap.size;

  const activePlansSnap = await collections.treatmentPlans()
    .where('practitioner_id', '==', doctorId)
    .where('status', '==', 'active').get();
  const activePlans = activePlansSnap.size;

  const today = new Date().toISOString().split('T')[0];
  const todaySnap = await collections.therapySessions()
    .where('practitioner_id', '==', doctorId)
    .where('scheduled_date', '==', today).get();
  const todaySessions = todaySnap.size;

  const completedSnap = await collections.therapySessions()
    .where('practitioner_id', '==', doctorId)
    .where('status', '==', 'completed').get();
  const completedSessions = completedSnap.size;

  const scheduledSnap = await collections.therapySessions()
    .where('practitioner_id', '==', doctorId)
    .where('status', '==', 'scheduled').get();
  const upcomingSessions = queryToArray(scheduledSnap).filter((s: any) => s.scheduled_date >= today).length;

  const unreadSnap = await collections.notifications().where('is_read', '==', 0).get();
  const unreadNotifications = unreadSnap.size;

  // Feedback scoped to this doctor's patients
  const doctorPatients = queryToArray(patientsSnap);
  const patientIds = doctorPatients.map((p: any) => p.id);
  let feedbackArr: any[] = [];
  if (patientIds.length > 0) {
    const fbSnap = await collections.patientFeedback().get();
    feedbackArr = queryToArray(fbSnap).filter((f: any) => patientIds.includes(f.patient_id));
  }
  const avgRating = feedbackArr.length > 0
    ? feedbackArr.reduce((sum: number, f: any) => sum + (f.overall_rating || 0), 0) / feedbackArr.length
    : 0;

  // Pending appointment requests (patients waiting for doctor approval)
  const pendingSessionSnap = await collections.therapySessions()
    .where('practitioner_id', '==', doctorId)
    .where('status', '==', 'pending').get();
  const pendingApptSnap = await collections.appointments()
    .where('doctor_id', '==', doctorId)
    .where('status', '==', 'pending').get();
  const pendingReview = pendingSessionSnap.size + pendingApptSnap.size;

  res.json({
    totalPatients, activePlans, todaySessions, completedSessions,
    upcomingSessions, unreadNotifications, pendingReview,
    averageRating: avgRating ? Number(avgRating.toFixed(1)) : 0,
  });
});

router.get('/upcoming-sessions', async (req: AuthRequest, res: Response) => {
  const doctorId = req.doctor!.id;
  const today = new Date().toISOString().split('T')[0];
  const snap = await collections.therapySessions()
    .where('practitioner_id', '==', doctorId)
    .where('status', '==', 'scheduled')
    .get();
  const sessions = queryToArray(snap)
    .filter((s: any) => s.scheduled_date >= today)
    .sort((a: any, b: any) => a.scheduled_date.localeCompare(b.scheduled_date) || a.scheduled_time.localeCompare(b.scheduled_time))
    .slice(0, 10);

  await Promise.all(sessions.map(async (s: any) => {
    const [ttDoc, pDoc, prDoc] = await Promise.all([
      collections.therapyTypes().doc(s.therapy_type_id).get(),
      collections.patients().doc(s.patient_id).get(),
      collections.practitioners().doc(s.practitioner_id).get(),
    ]);
    s.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
    s.category = ttDoc.exists ? ttDoc.data()?.category : '';
    s.patient_name = pDoc.exists ? pDoc.data()?.name : '';
    s.practitioner_name = prDoc.exists ? prDoc.data()?.name : '';
  }));

  res.json(sessions);
});

router.get('/therapy-distribution', async (req: AuthRequest, res: Response) => {
  const doctorId = req.doctor!.id;
  const allSessSnap = await collections.therapySessions().get();
  const sessions = queryToArray(allSessSnap).filter((s: any) => s.practitioner_id === doctorId);

  // Group by therapy_type_id
  const countMap: Record<string, number> = {};
  for (const s of sessions) {
    countMap[s.therapy_type_id] = (countMap[s.therapy_type_id] || 0) + 1;
  }

  const distribution = await Promise.all(
    Object.entries(countMap).map(async ([tid, count]) => {
      const ttDoc = await collections.therapyTypes().doc(tid).get();
      const name = ttDoc.exists ? (ttDoc.data()?.name || `Therapy ${tid.slice(0, 6)}`) : `Therapy ${tid.slice(0, 6)}`;
      return {
        name,
        category: ttDoc.exists ? ttDoc.data()?.category || '' : '',
        session_count: count,
      };
    })
  );
  distribution.sort((a, b) => b.session_count - a.session_count);

  res.json(distribution);
});

router.get('/weekly-sessions', async (req: AuthRequest, res: Response) => {
  const doctorId = req.doctor!.id;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0];

  const snap = await collections.therapySessions().get();
  const allSessions = queryToArray(snap);
  const sessions = allSessions.filter((s: any) => s.practitioner_id === doctorId && s.scheduled_date >= cutoff);

  // Group by scheduled_date
  const dateMap: Record<string, { count: number; completed: number; cancelled: number }> = {};
  for (const s of sessions) {
    if (!dateMap[s.scheduled_date]) dateMap[s.scheduled_date] = { count: 0, completed: 0, cancelled: 0 };
    dateMap[s.scheduled_date].count++;
    if (s.status === 'completed') dateMap[s.scheduled_date].completed++;
    if (s.status === 'cancelled') dateMap[s.scheduled_date].cancelled++;
  }

  const weekly = Object.entries(dateMap)
    .map(([scheduled_date, d]) => ({ scheduled_date, ...d }))
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  res.json(weekly);
});

router.get('/patient-progress', async (req: AuthRequest, res: Response) => {
  const doctorId = req.doctor!.id;
  const patientsSnap = await collections.patients()
    .where('practitioner_id', '==', doctorId).get();
  const patients = queryToArray(patientsSnap);

  const progressRaw = await Promise.all(patients.map(async (p: any) => {
    const [sessSnap, fbSnap] = await Promise.all([
      collections.therapySessions().where('patient_id', '==', p.id).get(),
      collections.patientFeedback().where('patient_id', '==', p.id).get(),
    ]);
    const totalSessions = sessSnap.size;
    if (totalSessions === 0) return null;
    const sessArr = queryToArray(sessSnap);
    const completedSessions = sessArr.filter((s: any) => s.status === 'completed').length;
    const fbArr = queryToArray(fbSnap);
    const avgRating = fbArr.length > 0
      ? fbArr.reduce((sum: number, f: any) => sum + (f.overall_rating || 0), 0) / fbArr.length
      : null;
    return { patient_name: p.name, patient_id: p.id, total_sessions: totalSessions, completed_sessions: completedSessions, avg_rating: avgRating };
  }));
  const progress = progressRaw.filter((x): x is NonNullable<typeof x> => x !== null);

  progress.sort((a, b) => b.completed_sessions - a.completed_sessions);
  res.json(progress.slice(0, 10));
});

// AI Dashboard Insights
router.get('/ai-insights', async (req: AuthRequest, res: Response) => {
  const doctorId = req.doctor!.id;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0];

  // Completion rate
  const allRecentSnap = await collections.therapySessions().get();
  const allRecentSessions = queryToArray(allRecentSnap);
  const recentSessions = allRecentSessions.filter((s: any) => s.practitioner_id === doctorId && s.scheduled_date >= cutoff);
  const allCount = recentSessions.length;
  const completed = recentSessions.filter((s: any) => s.status === 'completed').length;
  const noShows = recentSessions.filter((s: any) => s.status === 'no-show').length;
  const total = completed + noShows;
  const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

  // Side effects frequency
  const doctorPatients = queryToArray(await collections.patients()
    .where('practitioner_id', '==', doctorId).get());
  const doctorPatientIds = doctorPatients.map((p: any) => p.id);
  let allFeedback: any[] = [];
  if (doctorPatientIds.length > 0) {
    const fbSnap = await collections.patientFeedback().get();
    allFeedback = queryToArray(fbSnap).filter((f: any) => doctorPatientIds.includes(f.patient_id));
  }
  const recentFb = allFeedback.filter((f: any) =>
    f.created_at && f.created_at >= cutoff && f.side_effects && f.side_effects !== ''
  );
  const sideEffectsCount = recentFb.length;

  // Top performing therapies
  const therapyRatings: Record<string, { sum: number; count: number; name: string }> = {};
  const fbSessionDocs = await Promise.all(allFeedback.map((f: any) => collections.therapySessions().doc(f.session_id).get()));
  const uniqueTids = [...new Set(fbSessionDocs.filter(d => d.exists).map(d => d.data()?.therapy_type_id as string))];
  const ttDocs = await Promise.all(uniqueTids.map(tid => collections.therapyTypes().doc(tid).get()));
  const ttMap: Record<string, string> = {};
  ttDocs.forEach((d, i) => { if (d.exists) ttMap[uniqueTids[i]] = d.data()?.name || ''; });
  fbSessionDocs.forEach((sDoc, idx) => {
    if (!sDoc.exists) return;
    const tid = sDoc.data()?.therapy_type_id;
    if (!therapyRatings[tid]) therapyRatings[tid] = { sum: 0, count: 0, name: ttMap[tid] || '' };
    therapyRatings[tid].sum += allFeedback[idx].overall_rating;
    therapyRatings[tid].count++;
  });
  const topTherapies = Object.values(therapyRatings)
    .filter(t => t.count >= 2)
    .map(t => ({ name: t.name, avg_rating: Math.round((t.sum / t.count) * 10) / 10, feedback_count: t.count }))
    .sort((a, b) => b.avg_rating - a.avg_rating)
    .slice(0, 5);

  // Dosha distribution
  const doshaMap: Record<string, number> = {};
  for (const p of doctorPatients) {
    const dosha = p.current_dosha_imbalance;
    if (dosha) doshaMap[dosha] = (doshaMap[dosha] || 0) + 1;
  }
  const doshaDistribution = Object.entries(doshaMap).map(([dosha, count]) => ({ dosha, count }));

  // Schedule heatmap
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heatmapSnap = await collections.therapySessions().get();
  const heatmapAll = queryToArray(heatmapSnap);
  const doctorSessions = heatmapAll.filter((s: any) => s.practitioner_id === doctorId);
  const heatmap: Record<string, number> = {};
  for (const s of doctorSessions) {
    if (s.status === 'cancelled') continue;
    const dateObj = new Date(s.scheduled_date + 'T00:00:00');
    const day = dayNames[dateObj.getDay()];
    const key = `${day}|${s.scheduled_time}`;
    heatmap[key] = (heatmap[key] || 0) + 1;
  }
  const scheduleHeatmap = Object.entries(heatmap).map(([key, count]) => {
    const [day, hour] = key.split('|');
    return { day, hour, count };
  });

  res.json({
    completionRate,
    totalSessionsMonth: allCount,
    sideEffectsCount,
    topTherapies,
    doshaDistribution,
    scheduleHeatmap,
  });
});

export default router;
