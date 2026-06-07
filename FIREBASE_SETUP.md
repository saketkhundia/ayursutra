# AyurSutra - Firebase Setup

## Prerequisites
- Node.js 18+
- A Firebase project with Firestore enabled

## Firebase Setup

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/)

2. **Enable Firestore Database**:
   - Go to Build → Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" for development
   - Select a region close to you

3. **Generate a Service Account Key**:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the downloaded JSON file as `server/serviceAccountKey.json`

## Running the App

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Seed the database with sample data
cd ../server && npx tsx src/seed.ts

# Start the server
npx tsx src/index.ts

# In another terminal, start the frontend
cd client && npm run dev
```

The server runs on http://localhost:3001 and the frontend on http://localhost:5173.

## Optional: ML Service (for AI features)

```bash
cd ml-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

ML service runs on http://localhost:5000.
