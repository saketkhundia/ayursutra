import { initializeDatabase } from './models/database';
import db, { collections } from './models/database';

async function cleanup() {
  initializeDatabase();

  console.log('🧹 Starting cleanup of dummy data...\n');

  // If you want to keep specific data, modify the queries below
  // Otherwise, clear everything to start fresh

  const collectionNames = [
    'patient_feedback',
    'notifications', 
    'notification_preferences',
    'recovery_milestones',
    'therapy_sessions',
    'treatment_plans',
    'therapy_types',
    'patients',
    'practitioners',
  ];

  for (const name of collectionNames) {
    try {
      const snap = await db.collection(name).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`✅ Deleted ${snap.docs.length} documents from '${name}'`);
      } else {
        console.log(`⏭️  Collection '${name}' is already empty`);
      }
    } catch (error) {
      console.error(`❌ Error clearing '${name}':`, error);
    }
  }

  console.log('\n✨ Cleanup complete! Database is now empty.');
  console.log('📌 Real doctors can now register via the signup endpoint.');
  process.exit(0);
}

cleanup().catch(error => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
