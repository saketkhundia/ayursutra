import { initializeDatabase } from './models/database';
import { collections } from './models/database';

async function debug() {
  initializeDatabase();
  
  console.log('🔍 Checking doctors in database...\n');
  
  try {
    const snap = await collections.practitioners().get();
    console.log(`Total practitioners in DB: ${snap.size}`);
    
    snap.docs.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\n[${idx + 1}] Doctor: "${data.name}"`);
      console.log(`    ID: ${doc.id}`);
      console.log(`    Email: ${data.email}`);
      console.log(`    Active: ${data.is_active}`);
      console.log(`    Verified: ${data.verified}`);
      console.log(`    Self-registered: ${data.is_self_registered}`);
      console.log(`    Specialization: ${data.specialization}`);
      console.log(`    Created at: ${data.created_at}`);
    });
    
    if (snap.empty) {
      console.log('\n❌ NO DOCTORS FOUND IN DATABASE');
    } else {
      console.log(`\n✅ Found ${snap.size} doctor(s)`);
    }
  } catch (error: any) {
    console.error('❌ Error querying doctors:', error.message);
  }
  
  process.exit(0);
}

debug();
