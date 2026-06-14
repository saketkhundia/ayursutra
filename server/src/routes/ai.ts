/**
 * ATASS AI Routes
 * Proxy to Python ML service.
 * Handles: Smart scheduling, therapy recommendations, treatment insights.
 */
import { Router, Request, Response } from 'express';
import db, { collections, docToObj, queryToArray } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { notifyPatient } from '../services/notification-service';
import { emitSessionCreated, emitDashboardRefresh } from '../services/realtime';

const router = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const ML_REQUEST_TIMEOUT = 15000; // Senior dev: 15s timeout instead of default 5s

async function mlRequest(path: string, body: any, retries = 2): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ML_REQUEST_TIMEOUT);
      
      const resp = await fetch(`${ML_SERVICE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`ML service error: ${resp.status}`);
      return resp.json();
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        console.warn(`[ML Request] Attempt ${attempt + 1} failed, retrying...`);
        await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // Exponential backoff
      }
    }
  }
  throw lastError;
}

// Senior dev: Health check endpoint for frontend monitoring
router.post('/health', async (req: Request, res: Response) => {
  try {
    const healthReq = await fetch(`${ML_SERVICE_URL}/api/ai/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    
    const isMLHealthy = healthReq.ok;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        backend: 'ok',
        ml_service: isMLHealthy ? 'ok' : 'unavailable',
      },
      ai_available: isMLHealthy,
    });
  } catch (err) {
    res.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        backend: 'ok',
        ml_service: 'unavailable',
      },
      ai_available: false,
    });
  }
});

// AI-powered slot suggestions
router.post('/schedule/suggest', async (req: Request, res: Response) => {
  // Cache-busting headers for AI responses
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  try {
    const { therapy_type_id, practitioner_id, patient_id, start_date, num_days } = req.body;

    const ttDoc = await collections.therapyTypes().doc(therapy_type_id).get();
    const pDoc = await collections.patients().doc(patient_id).get();
    const therapy = ttDoc.exists ? { id: ttDoc.id, ...ttDoc.data() } as any : null;
    const patient = pDoc.exists ? { id: pDoc.id, ...pDoc.data() } as any : null;
    if (!therapy || !patient) return res.status(404).json({ error: 'Therapy or patient not found' });

    const existingSnap = await collections.therapySessions().get();
    const existing = queryToArray(existingSnap).filter((s: any) => s.status !== 'cancelled').map((s: any) => ({
      scheduled_date: s.scheduled_date, scheduled_time: s.scheduled_time,
      duration_minutes: s.duration_minutes, practitioner_id: s.practitioner_id,
      patient_id: s.patient_id, status: s.status,
    }));

    const historySnap = await collections.therapySessions()
      .where('patient_id', '==', patient_id)
      .where('status', '==', 'completed').get();
    const history = queryToArray(historySnap).map((s: any) => ({
      time: s.scheduled_time, score: s.progress_score,
    }));

    // Fetch doctor's manually posted availability
    const availSnap = await collections.practitionerAvailability()
      .where('practitioner_id', '==', practitioner_id).get();
    const doctor_availability = queryToArray(availSnap).map((av: any) => ({
      day_of_week: av.day_of_week,
      start_time: av.start_time,
      end_time: av.end_time,
    }));

    const result = await mlRequest('/api/ai/schedule/suggest', {
      therapy_name: therapy.name,
      therapy_duration: therapy.duration_minutes,
      patient_dosha: patient.current_dosha_imbalance || 'Tridosha',
      practitioner_id,
      existing_sessions: existing,
      patient_history: history,
      start_date,
      num_days: num_days || 14,
      doctor_availability: doctor_availability.length > 0 ? doctor_availability : null,
    });

    res.json(result);
  } catch (err: any) {
    console.error('[AI Suggest] ML service unavailable:', err.message);
    res.status(503).json({
      error: 'AI scheduling analysis is unavailable. Start or configure the ML service, then try again.',
      details: err.message,
      ai_available: false,
    });
  }
});

// AI-powered auto-scheduling with conflict resolution
router.post('/schedule/auto', async (req: Request, res: Response) => {
  // Cache-busting headers for AI responses
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  try {
    const {
      treatment_plan_id, therapy_type_id, patient_id, practitioner_id,
      start_date, num_sessions, frequency_days, preferred_time
    } = req.body;

    const ttDoc = await collections.therapyTypes().doc(therapy_type_id).get();
    const pDoc = await collections.patients().doc(patient_id).get();
    const therapy = ttDoc.exists ? { id: ttDoc.id, ...ttDoc.data() } as any : null;
    const patient = pDoc.exists ? { id: pDoc.id, ...pDoc.data() } as any : null;
    if (!therapy || !patient) return res.status(404).json({ error: 'Therapy or patient not found' });

    const existingSnap = await collections.therapySessions().get();
    const existing = queryToArray(existingSnap).filter((s: any) => s.status !== 'cancelled').map((s: any) => ({
      scheduled_date: s.scheduled_date, scheduled_time: s.scheduled_time,
      duration_minutes: s.duration_minutes, practitioner_id: s.practitioner_id,
      patient_id: s.patient_id, status: s.status,
    }));

    const historySnap = await collections.therapySessions()
      .where('patient_id', '==', patient_id)
      .where('status', '==', 'completed').get();
    const history = queryToArray(historySnap).map((s: any) => ({
      time: s.scheduled_time, score: s.progress_score,
    }));

    // Fetch doctor's manually posted availability
    const availSnap = await collections.practitionerAvailability()
      .where('practitioner_id', '==', practitioner_id).get();
    const doctor_availability = queryToArray(availSnap).map((av: any) => ({
      day_of_week: av.day_of_week,
      start_time: av.start_time,
      end_time: av.end_time,
    }));

    const aiResult = await mlRequest('/api/ai/schedule/auto', {
      therapy_name: therapy.name,
      therapy_duration: therapy.duration_minutes,
      patient_dosha: patient.current_dosha_imbalance || 'Tridosha',
      practitioner_id,
      existing_sessions: existing,
      patient_history: history,
      start_date, num_sessions,
      frequency_days: frequency_days || 3,
      preferred_time,
      doctor_availability: doctor_availability.length > 0 ? doctor_availability : null,
    });

    // Create the actual sessions in Firestore
    const createdSessions: any[] = [];
    for (const s of aiResult.sessions) {
      const id = uuidv4();
      const now = new Date().toISOString();
      await collections.therapySessions().doc(id).set({
        treatment_plan_id, therapy_type_id, patient_id, practitioner_id,
        scheduled_date: s.date, scheduled_time: s.time,
        duration_minutes: therapy.duration_minutes,
        status: 'scheduled', actual_start_time: null, actual_end_time: null,
        session_notes: null, progress_score: null, ai_confidence: s.confidence || null,
        created_at: now, updated_at: now,
      });

      await notifyPatient({
        patient_id, session_id: id, type: 'reminder',
        title: 'AI-Scheduled Session',
        message: `${therapy.name} session on ${s.date} at ${s.time} (AI confidence: ${Math.round(s.confidence * 100)}%).`,
        scheduled_for: `${s.date} ${s.time}`,
      });

      createdSessions.push({ id, ...s });
    }

    emitDashboardRefresh();

    res.status(201).json({
      ...aiResult, sessions: createdSessions,
      message: `${createdSessions.length} sessions AI-scheduled with conflict resolution`,
    });
  } catch (err: any) {
    console.error('[AI Auto-Schedule]', err.message);
    res.status(500).json({ error: 'AI scheduling failed. Please try manual scheduling.', details: err.message });
  }
});

// Therapy recommendations based on feedback
router.post('/recommend', async (req: Request, res: Response) => {
  // Cache-busting headers for AI responses
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  try {
    const { patient_id } = req.body;
    const pDoc = await collections.patients().doc(patient_id).get();
    if (!pDoc.exists) return res.status(404).json({ error: 'Patient not found' });
    const patient = { id: pDoc.id, ...pDoc.data() } as any;

    const fbSnap = await collections.patientFeedback()
      .where('patient_id', '==', patient_id)
      .get();
    const feedback = queryToArray(fbSnap).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
    for (const f of feedback) {
      const sDoc = await collections.therapySessions().doc(f.session_id).get();
      if (sDoc.exists) {
        const ttDoc = await collections.therapyTypes().doc(sDoc.data()?.therapy_type_id).get();
        f.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
      }
    }

    const ttSnap = await collections.therapyTypes().get();
    const therapies = queryToArray(ttSnap).filter((t: any) => t.is_active === 1).map((t: any) => ({ id: t.id, name: t.name, category: t.category }));

    const result = await mlRequest('/api/ai/personalize/recommend', {
      patient_dosha: patient.current_dosha_imbalance || 'Tridosha',
      feedback_history: feedback,
      available_therapies: therapies,
    });

    res.json(result);
  } catch (err: any) {
    console.error('[AI Recommend]', err.message);
    const ttSnap = await collections.therapyTypes().get();
    const therapies = queryToArray(ttSnap).filter((t: any) => t.is_active === 1);
    res.json({
      recommendations: therapies.map((t: any) => ({
        therapy_id: t.id, therapy_name: t.name, category: t.category,
        score: 50 + Math.random() * 30, confidence: 0.4,
        reasons: ['Basic recommendation (AI service offline)'],
        recommendation: 'Consider',
      })),
      fallback: true,
    });
  }
});

// Treatment insights and predictions
router.post('/insights', async (req: Request, res: Response) => {
  try {
    const { patient_id } = req.body;
    const pDoc = await collections.patients().doc(patient_id).get();
    if (!pDoc.exists) return res.status(404).json({ error: 'Patient not found' });
    const patient = { id: pDoc.id, ...pDoc.data() };

    const fbSnap = await collections.patientFeedback()
      .where('patient_id', '==', patient_id)
      .get();
    const feedback = queryToArray(fbSnap).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
    for (const f of feedback) {
      const sDoc = await collections.therapySessions().doc(f.session_id).get();
      if (sDoc.exists) {
        const ttDoc = await collections.therapyTypes().doc(sDoc.data()?.therapy_type_id).get();
        f.therapy_name = ttDoc.exists ? ttDoc.data()?.name : '';
      }
    }

    const sessSnap = await collections.therapySessions()
      .where('patient_id', '==', patient_id).get();
    const sessions = queryToArray(sessSnap);

    const result = await mlRequest('/api/ai/personalize/insights', {
      patient_data: patient,
      feedback_history: feedback,
      sessions,
    });

    res.json(result);
  } catch (err: any) {
    console.error('[AI Insights]', err.message);
    res.json({ insights: [{ type: 'info', title: 'AI Offline', message: 'ML service unavailable. Insights will appear when service is running.', priority: 'low' }], fallback: true });
  }
});

export default router;
