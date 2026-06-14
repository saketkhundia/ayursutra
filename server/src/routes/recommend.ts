/**
 * Therapy Recommendation Routes
 * Based on patient profile, appointment history, and current needs
 */
import { Router, Request, Response } from 'express';
import db, { collections, queryToArray } from '../models/database';

const router = Router();

/**
 * POST /recommend/therapies-for-appointment
 * Get therapy recommendations for a specific appointment
 * 
 * Request body:
 * - appointment_id: string
 * - patient_id: string
 * - therapy_type_id: string (the main therapy requested)
 */
router.post('/therapies-for-appointment', async (req: Request, res: Response) => {
  try {
    let { appointment_id, patient_id, therapy_type_id, therapy_type } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: 'Missing patient_id' });
    }

    if (!therapy_type_id && !therapy_type) {
      return res.status(400).json({ error: 'Missing therapy_type_id or therapy_type' });
    }

    // If therapy_type_id looks like a name (not a UUID/doc ID), treat it as a therapy name
    // This handles the case where frontend sends therapy_type as both therapy_type_id and therapy_type
    if (therapy_type_id && !therapy_type) {
      // If it's not a valid doc ID format (looks like a name), search by name
      if (!/^[a-zA-Z0-9_-]{20,}$/.test(therapy_type_id)) {
        therapy_type = therapy_type_id;
        therapy_type_id = undefined;
      }
    }

    // If we have a therapy name, try to find it (case-insensitive)
    if (therapy_type && !therapy_type_id) {
      // Get all therapy types and search client-side (case-insensitive)
      const ttSnap = await collections.therapyTypes().get();
      const therapies = ttSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Try exact match first
      let matched = therapies.find(t => t.name === therapy_type);
      
      // Try case-insensitive match
      if (!matched) {
        matched = therapies.find(t => t.name?.toLowerCase() === therapy_type?.toLowerCase());
      }
      
      // Try partial match
      if (!matched) {
        matched = therapies.find(t => t.name?.toLowerCase()?.includes(therapy_type?.toLowerCase()));
      }
      
      if (!matched) {
        console.warn(`[Recommend] Therapy type "${therapy_type}" not found. Available:`, therapies.map(t => t.name).join(', '));
        return res.status(404).json({ 
          error: `Therapy type "${therapy_type}" not found. Available therapies: ${therapies.map(t => t.name).join(', ')}`,
          debug: { searched_for: therapy_type, available: therapies.map(t => t.name) }
        });
      }
      therapy_type_id = matched.id;
    }

    // Fetch patient profile
    const pDoc = await collections.patients().doc(patient_id).get();
    if (!pDoc.exists) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = pDoc.data();

    // Fetch main therapy type
    const ttDoc = await collections.therapyTypes().doc(therapy_type_id).get();
    if (!ttDoc.exists) {
      return res.status(404).json({ error: `Therapy type with ID "${therapy_type_id}" not found` });
    }
    const mainTherapy = { id: ttDoc.id, ...ttDoc.data() };

    // Get patient's completed sessions to understand what works
    const sessionsSnap = await collections.therapySessions()
      .where('patient_id', '==', patient_id)
      .where('status', '==', 'completed')
      .get();
    const completedSessions = queryToArray(sessionsSnap);

    // Fetch all therapy types for recommendations
    const allTherapiesSnap = await collections.therapyTypes().where('is_active', '==', 1).get();
    const allTherapies = queryToArray(allTherapiesSnap);

    // Algorithm to recommend complementary therapies
    const recommendations = recommendTherapies(
      mainTherapy,
      patient,
      completedSessions,
      allTherapies
    );

    res.json({
      appointment_id,
      patient_id,
      main_therapy: mainTherapy,
      patient_dosha: patient?.current_dosha_imbalance,
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      reason: 'AI-recommended therapies based on patient profile and session history',
    });
  } catch (error: any) {
    console.error('[Recommend] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Recommendation algorithm
 * Returns therapies that complement the main therapy
 */
function recommendTherapies(
  mainTherapy: any,
  patient: any,
  completedSessions: any[],
  allTherapies: any[]
) {
  const recommendations: any[] = [];

  // Get therapy sequences (what therapies work best together)
  const THERAPY_SEQUENCES: Record<string, { prep?: string[]; follow?: string[] }> = {
    Vamana: { prep: ['Abhyanga', 'Swedana'], follow: ['rest'] },
    Virechana: { prep: ['Abhyanga', 'Swedana'], follow: ['Basti'] },
    Basti: { prep: ['Abhyanga'], follow: ['Nasya'] },
    Nasya: { prep: ['Abhyanga', 'Swedana'], follow: ['Shirodhara'] },
    Raktamokshana: { prep: ['Abhyanga'], follow: ['rest'] },
    Abhyanga: { prep: [], follow: ['Swedana', 'Basti', 'Nasya'] },
    Swedana: { prep: ['Abhyanga'], follow: ['Vamana', 'Virechana', 'Basti'] },
    Shirodhara: { prep: ['Abhyanga'], follow: ['rest'] },
  };

  // Dosha-specific therapy recommendations
  const DOSHA_THERAPIES: Record<string, string[]> = {
    Vata: ['Abhyanga', 'Basti', 'Nasya', 'Shirodhara'],
    Pitta: ['Shirodhara', 'Nasya', 'Virechana'],
    Kapha: ['Vamana', 'Nasya', 'Swedana'],
    'Vata-Pitta': ['Abhyanga', 'Nasya', 'Shirodhara'],
    'Pitta-Kapha': ['Virechana', 'Nasya'],
    'Vata-Kapha': ['Abhyanga', 'Swedana', 'Basti'],
    Tridosha: ['Abhyanga', 'Swedana', 'Nasya'],
  };

  const mainTherapyName = mainTherapy.name;
  const patientDosha = patient?.current_dosha_imbalance || 'Tridosha';

  // 1. Add preparatory therapies (should come before)
  const prepTherapies = THERAPY_SEQUENCES[mainTherapyName]?.prep || [];
  for (const prepName of prepTherapies) {
    const therapy = allTherapies.find(t => t.name === prepName);
    if (therapy) {
      recommendations.push({
        id: therapy.id,
        name: therapy.name,
        category: therapy.category,
        duration_minutes: therapy.duration_minutes,
        type: 'preparatory',
        reason: `Prepare body for ${mainTherapyName}`,
        score: 95,
      });
    }
  }

  // 2. Add follow-up therapies (should come after)
  const followTherapies = THERAPY_SEQUENCES[mainTherapyName]?.follow || [];
  for (const followName of followTherapies) {
    if (followName !== 'rest') {
      const therapy = allTherapies.find(t => t.name === followName);
      if (therapy) {
        recommendations.push({
          id: therapy.id,
          name: therapy.name,
          category: therapy.category,
          duration_minutes: therapy.duration_minutes,
          type: 'follow-up',
          reason: `Complements ${mainTherapyName}`,
          score: 90,
        });
      }
    }
  }

  // 3. Add dosha-specific recommendations (if therapy not already in list)
  const doshaTherapyNames = DOSHA_THERAPIES[patientDosha] || [];
  for (const therapyName of doshaTherapyNames) {
    if (
      therapyName !== mainTherapyName &&
      !recommendations.find(r => r.name === therapyName)
    ) {
      const therapy = allTherapies.find(t => t.name === therapyName);
      if (therapy) {
        recommendations.push({
          id: therapy.id,
          name: therapy.name,
          category: therapy.category,
          duration_minutes: therapy.duration_minutes,
          type: 'dosha-specific',
          reason: `Balances ${patientDosha} dosha`,
          score: 80,
        });
      }
    }
  }

  // 4. Add therapies patient had success with (if not already in list)
  const successfulTherapies = completedSessions
    .filter(s => s.progress_score >= 80) // Good outcomes
    .map(s => s.therapy_type_id);

  for (const therapyId of successfulTherapies) {
    if (!recommendations.find(r => r.id === therapyId)) {
      const therapy = allTherapies.find(t => t.id === therapyId);
      if (therapy && therapy.name !== mainTherapyName) {
        recommendations.push({
          id: therapy.id,
          name: therapy.name,
          category: therapy.category,
          duration_minutes: therapy.duration_minutes,
          type: 'proven-effective',
          reason: 'Patient had excellent results with this therapy',
          score: 85,
        });
      }
    }
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Remove duplicates (keep highest score)
  const unique = Array.from(
    new Map(recommendations.map(r => [r.id, r])).values()
  );

  return unique;
}

export default router;
