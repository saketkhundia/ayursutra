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

4. **Enable Google Authentication** (for Google OAuth login):
   - Go to Build → Authentication → Sign-in method
   - Click "Add new provider" → Google
   - Enable it and enter a support email
   - Save

5. **Add a Web App** (for the client Firebase SDK):
   - Go to Project Settings → General → Your apps → Add app → Web
   - Register the app (nickname: "AyurSutra Web")
   - Copy the `firebaseConfig` object values
   - Fill them into `client/.env`:
     ```
     VITE_FIREBASE_API_KEY=your-api-key
     VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=your-project-id
     VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
     VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
     VITE_FIREBASE_APP_ID=1:123456789:web:abc123
     ```

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
