const admin = require('firebase-admin');
const serviceAccount = require('/home/saket/Desktop/Projects/ayursutra/ayursutra-55715-firebase-adminsdk-fbsvc-1b64da6dca.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ayursutra-55715.firebaseio.com'
});

const db = admin.firestore();

async function addTherapyType() {
  try {
    const therapyType = {
      name: 'Ayrvedic massage',
      description: 'Traditional Ayurvedic massage therapy',
      category: 'massage',
      duration_minutes: 60,
      benefits: ['Relaxation', 'Improved circulation', 'Stress relief'],
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await db.collection('therapy_types').add(therapyType);
    console.log('✅ Added therapy type: Ayrvedic massage with ID:', docRef.id);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

addTherapyType();
