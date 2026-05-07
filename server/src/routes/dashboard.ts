import { Router, Request, Response } from 'express';
import db, { collections, queryToArray } from '../models/database';

const router = Router();

router.get('/stats', async (_req: Request, res: Response) => {
  const patientsSnap = await collections.patients().get();
  const totalPatients = patientsSnap.size;

  const activePlansSnap = await collections.treatmentPlans().where('status', '==', 'active').get();
  const activePlans = activePlansSnap.size;

  const today = new Date().toISOString().split('T')[0];
  const todaySnap = await collections.therapySessions().where('scheduled_date', '==', today).get();
  const todaySessions = todaySnap.size;

  const completedSnap = await collections.therapySessions().where('status', '==', 'completed').get();
  const completedSessions = completedSnap.size;

  const scheduledSnap = await collections.therapySessions()
    .where('status', '==', 'scheduled').get();
  const upcomingSessions = queryToArray(scheduledSnap).filter((s: any) => s.scheduled_date >= today).length;

  const unreadSnap = await collections.notifications().where('is_read', '==', 0).get();
  const unreadNotifications = unreadSnap.size;

  const feedbackSnap = await collections.patientFeedback().get();
  const feedbackArr = queryToArray(feedbackSnap);
  const avgRating = feedbackArr.length > 0
    ? feedbackArr.reduce((sum: number, f: any) => sum + (f.overall_rating || 0), 0) / feedbackArr.length
    : 0;

  res.json({
    totalPatients, activePlans, todaySessions, completedSessions,
    upcomingSessions, unreadNotifications,
    averageRating: avgRating ? Number(avgRating.toFixed(1)) : 0,
  });
});

router.get('/upcoming-sessions', async (_req: Request, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const snap = await collections.therapySessions()
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

router.get('/therapy-distribution', async (_req: Request, res: Response) => {
  const sessSnap = await collections.therapySessions().get();
  const sessions = queryToArray(sessSnap);

  // Group by therapy_type_id
  const countMap: Record<string, number> = {};
  for (const s of sessions) {
    countMap[s.therapy_type_id] = (countMap[s.therapy_type_id] || 0) + 1;
  }

  const distribution = await Promise.all(
    Object.entries(countMap).map(async ([tid, count]) => {
      const ttDoc = await collections.therapyTypes().doc(tid).get();
      return {
        name: ttDoc.exists ? ttDoc.data()?.name : tid,
        category: ttDoc.exists ? ttDoc.data()?.category : '',
        session_count: count,
      };
    })
  );
  distribution.sort((a, b) => b.session_count - a.session_count);

  res.json(distribution);
});

router.get('/weekly-sessions', async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0];

  const snap = await collections.therapySessions()
    .where('scheduled_date', '>=', cutoff).get();
  const sessions = queryToArray(snap);

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

router.get('/patient-progress', async (_req: Request, res: Response) => {
  const patientsSnap = await collections.patients().get();
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
router.get('/ai-insights', async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0];

  // Completion rate
  const recentSnap = await collections.therapySessions()
    .where('scheduled_date', '>=', cutoff).get();
  const recentSessions = queryToArray(recentSnap);
  const total = recentSessions.length;
  const completed = recentSessions.filter((s: any) => s.status === 'completed').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

  // Side effects frequency
  const fbSnap = await collections.patientFeedback().get();
  const allFeedback = queryToArray(fbSnap);
  const recentFb = allFeedback.filter((f: any) =>
    f.created_at && f.created_at >= cutoff && f.side_effects && f.side_effects !== ''
  );
  const sideEffectsCount = recentFb.length;

  // Top performing therapies — fetch all sessions in parallel
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
  const patientsSnap = await collections.patients().get();
  const doshaMap: Record<string, number> = {};
  for (const doc of patientsSnap.docs) {
    const dosha = doc.data().current_dosha_imbalance;
    if (dosha) doshaMap[dosha] = (doshaMap[dosha] || 0) + 1;
  }
  const doshaDistribution = Object.entries(doshaMap).map(([dosha, count]) => ({ dosha, count }));

  // Schedule heatmap
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const allSessSnap = await collections.therapySessions().get();
  const heatmap: Record<string, number> = {};
  for (const doc of allSessSnap.docs) {
    const d = doc.data();
    if (d.status === 'cancelled') continue;
    const dateObj = new Date(d.scheduled_date + 'T00:00:00');
    const day = dayNames[dateObj.getDay()];
    const key = `${day}|${d.scheduled_time}`;
    heatmap[key] = (heatmap[key] || 0) + 1;
  }
  const scheduleHeatmap = Object.entries(heatmap).map(([key, count]) => {
    const [day, hour] = key.split('|');
    return { day, hour, count };
  });

  res.json({
    completionRate,
    totalSessionsMonth: total,
    sideEffectsCount,
    topTherapies,
    doshaDistribution,
    scheduleHeatmap,
  });
});

export default router;
