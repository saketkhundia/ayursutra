// Firestore Composite Index Setup
// Deploy indexes via: firebase deploy --only firestore:indexes
// Or deploy within the project: npx firebase-tools deploy --only firestore:indexes
// Indexes are defined in the root firestore.indexes.json

console.log('◈ Firestore Composite Index Configuration');
console.log('');
console.log('Indexes are defined in the root firestore.indexes.json file.');
console.log('');
console.log('To deploy indexes, run:');
console.log('  firebase deploy --only firestore:indexes');
console.log('');
console.log('Required composite indexes:');
console.log('');
console.log('Collection: therapy_sessions');
console.log('  1. practitioner_id (ASC), scheduled_date (ASC)');
console.log('  2. practitioner_id (ASC), status (ASC)');
console.log('  3. practitioner_id (ASC), patient_id (ASC)');
console.log('');
console.log('Collection: appointments');
console.log('  4. doctor_id (ASC), status (ASC)');
console.log('  5. doctor_id (ASC), created_at (DESC)');
console.log('');
console.log('Collection: treatment_plans');
console.log('  6. practitioner_id (ASC), status (ASC)');
console.log('');
console.log('Collection: practitioner_availability');
console.log('  7. practitioner_id (ASC), day_of_week (ASC)');
console.log('');
console.log('Or visit:');
console.log('https://console.firebase.google.com/project/ayursutra-55715/firestore/indexes');

