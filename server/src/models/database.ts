import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getConfig } from '../config';
import path from 'path';
import fs from 'fs';

let db!: Firestore;

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

export function docToObj(doc: FirebaseFirestore.DocumentSnapshot): any {
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export function queryToArray(snapshot: FirebaseFirestore.QuerySnapshot): any[] {
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function initializeDatabase(): void {
  const serviceAccountPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');

  if (getApps().length > 0) {
    console.log('[Firestore] Already initialized');
    db = getFirestore();
    return;
  }

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
    console.log('[Firestore] Initialized with service account file');
  } else {
    const config = getConfig();
    const privateKey = (config.FIREBASE_PRIVATE_KEY || '')
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: config.FIREBASE_PROJECT_ID,
        privateKey,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log('[Firestore] Initialized with environment config');
  }

  db = getFirestore();
}

/** Get the Firestore instance (safe to call after initializeDatabase) */
export function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    throw new Error('Firestore not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/** Create a Firestore write batch */
export function batch() {
  return getDb().batch();
}
