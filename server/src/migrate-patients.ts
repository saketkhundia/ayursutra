import { initializeDatabase } from './models/database';
import { collections, queryToArray } from './models/database';

async function migratePatients() {
  initializeDatabase();

  const plansSnap = await collections.treatmentPlans().get();
  const plans = queryToArray(plansSnap);

  // Build map: patient_id -> set of practitioner_ids
  const patientPractitionerMap: Record<string, Set<string>> = {};
  for (const plan of plans) {
    if (!plan.patient_id || !plan.practitioner_id) continue;
    if (!patientPractitionerMap[plan.patient_id]) {
      patientPractitionerMap[plan.patient_id] = new Set();
    }
    patientPractitionerMap[plan.patient_id].add(plan.practitioner_id);
  }

  const patientsSnap = await collections.patients().get();
  let updated = 0;
  let skipped = 0;

  for (const doc of patientsSnap.docs) {
    const data = doc.data();
    // Skip patients that already have practitioner_id
    if (data.practitioner_id) {
      skipped++;
      continue;
    }

    const practitionerIds = patientPractitionerMap[doc.id];
    if (!practitionerIds || practitionerIds.size === 0) {
      console.log(`  SKIP: patient ${doc.id} (${data.name || 'unnamed'}) has no treatment plans — can't determine practitioner`);
      skipped++;
      continue;
    }

    // If a patient has multiple practitioners, take the first one
    const practitionerId = practitionerIds.values().next().value;
    if (practitionerIds.size > 1) {
      console.log(`  WARN: patient ${doc.id} (${data.name}) has ${practitionerIds.size} practitioners, using first: ${practitionerId}`);
    }

    await collections.patients().doc(doc.id).update({ practitioner_id: practitionerId });
    console.log(`  UPDATED: patient ${doc.id} (${data.name}) -> practitioner ${practitionerId}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

migratePatients().catch(console.error);
