import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');

if (getApps().length === 0) {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp();
  }
}

const db: Firestore = getFirestore();

// Collections reference helpers
export const collections = {
  practitioners: () => db.collection('practitioners'),
  patients: () => db.collection('patients'),
  therapyTypes: () => db.collection('therapy_types'),
  treatmentPlans: () => db.collection('treatment_plans'),
  therapySessions: () => db.collection('therapy_sessions'),
  notifications: () => db.collection('notifications'),
  patientFeedback: () => db.collection('patient_feedback'),
  recoveryMilestones: () => db.collection('recovery_milestones'),
  notificationPreferences: () => db.collection('notification_preferences'),
  aiSchedulingLog: () => db.collection('ai_scheduling_log'),
  therapyRecommendations: () => db.collection('therapy_recommendations'),
  practitionerAvailability: () => db.collection('practitioner_availability'),
  messages: () => db.collection('messages'),
  conversations: () => db.collection('conversations'),
  appointments: () => db.collection('appointments'),
};

// Helper to convert Firestore doc to plain object with id
export function docToObj(doc: FirebaseFirestore.DocumentSnapshot): any {
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// Helper to convert query snapshot to array
export function queryToArray(snapshot: FirebaseFirestore.QuerySnapshot): any[] {
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// No-op init (Firestore doesn't need table creation)
export function initializeDatabase(): void {
  console.log('[Firestore] Connected to Firebase');
}

export default db;
