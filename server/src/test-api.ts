import fetch from 'node-fetch';

async function testAPI() {
  try {
    console.log('Testing /api/practitioners/public endpoint...\n');
    const response = await fetch('http://localhost:3001/api/practitioners/public');
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    
    if (Array.isArray(data) && data.length > 0) {
      console.log(`\n✅ Found ${data.length} doctor(s) in the API!`);
      data.forEach((doc, idx) => {
        console.log(`   [${idx + 1}] ${doc.name} - ${doc.specialization}`);
      });
    } else {
      console.log('\n❌ API returned empty list');
    }
  } catch (error: any) {
    console.error('❌ API test failed:', error.message);
  }
  process.exit(0);
}

testAPI();
