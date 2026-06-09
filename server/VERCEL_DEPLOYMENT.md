# Vercel Backend Deployment Guide

## Prerequisites

- [ ] Vercel account (free at [vercel.com](https://vercel.com))
- [ ] GitHub account with repo pushed
- [ ] Firebase project with credentials
- [ ] JWT secrets generated (min 32 characters)

---

## Step 1: Generate Secure Secrets

Run this command to generate 2 secure JWT secrets:

```bash
node -e "console.log('JWT_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
```

Save these values - you'll need them in Vercel settings.

---

## Step 2: Get Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **Project Settings** (gear icon)
4. Go to **Service Accounts** tab
5. Click **Generate new private key**
6. Open the downloaded JSON file and copy:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (multiline, keep as-is)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

---

## Step 3: Deploy Backend to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New...** → **Project**
3. Import your GitHub repository
4. Configure the project:
   - **Project Name**: `ayursutra-api`
   - **Root Directory**: `server` ✅
   - **Framework**: `Other`
   - **Build Command**: `npm run build` ✅
   - **Output Directory**: `dist` ✅
   - **Install Command**: `npm install` ✅

5. Click **Environment Variables** and add:

```
NODE_ENV = production
PORT = 3001
FIREBASE_PROJECT_ID = your-value-here
FIREBASE_PRIVATE_KEY = your-value-here (paste entire key)
FIREBASE_CLIENT_EMAIL = your-value-here
JWT_SECRET = your-generated-secret
JWT_REFRESH_SECRET = your-generated-secret
ALLOWED_ORIGINS = https://your-frontend-url.vercel.app
ML_SERVICE_URL = https://your-ml-service.railway.app
HTTPS_REDIRECT = true
LOG_LEVEL = info
RATE_LIMIT_MAX_REQUESTS = 100
RATE_LIMIT_WINDOW = 15
```

6. Click **Deploy**

---

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Navigate to server directory
cd server

# Deploy
vercel --prod

# Follow prompts to set environment variables
```

---

## Step 4: Verify Deployment

Once deployed, Vercel will provide a URL like: `https://ayursutra-api.vercel.app`

Test it:

```bash
curl https://your-vercel-url/api/health
```

Should return:
```json
{
  "status": "healthy",
  "name": "ATASS API",
  "version": "2.0.0",
  "environment": "production"
}
```

---

## Step 5: Update Frontend API URL

Once backend is deployed, update your frontend:

**File**: `client/.env` or environment variables

```
VITE_API_URL=https://your-vercel-url/api
```

Or update in Vercel frontend project settings with same variable.

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `FIREBASE_PROJECT_ID` | Firebase project ID | `ayursutra-prod-12345` |
| `FIREBASE_PRIVATE_KEY` | Firebase service account key | `-----BEGIN PRIVATE KEY-----\n...` |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | `firebase-adminsdk-@...iam.gserviceaccount.com` |
| `JWT_SECRET` | Access token secret | 64-char hex string |
| `JWT_REFRESH_SECRET` | Refresh token secret | 64-char hex string |
| `ML_SERVICE_URL` | ML service endpoint | `https://your-ml.railway.app` |
| `ALLOWED_ORIGINS` | CORS whitelist | `https://your-frontend.vercel.app` |
| `HTTPS_REDIRECT` | Force HTTPS | `true` |
| `LOG_LEVEL` | Logging level | `info` |

---

## Troubleshooting

### Build Fails

```
ERROR: Cannot find module '@vercel/node'
```

**Solution**: Vercel auto-installs `@vercel/node`. Check `vercel.json` is in the root of `server/`.

### WebSocket Connection Fails

Add to `ALLOWED_ORIGINS` in backend env:
```
https://your-frontend-domain.com
```

### 500 Errors in Logs

1. Check Environment Variables in Vercel dashboard
2. Verify Firebase credentials are correct
3. Check Vercel Function Logs (click deployment → Logs tab)

### Timeout Issues

Vercel free tier has 10-second timeout. For long operations:
- Increase function memory in `vercel.json` (already set to 3008MB)
- Break operations into smaller chunks

---

## Monitoring & Logs

View logs in Vercel Dashboard:
1. Click your deployment
2. Go to **Logs** tab
3. Select **Function Logs** to see real-time errors

---

## Next Steps

1. ✅ Deploy backend
2. ⏭️ Deploy frontend (see FRONTEND_DEPLOYMENT.md)
3. ⏭️ Deploy ML service (see ML_DEPLOYMENT.md)
4. ⏭️ Configure custom domain (optional)

---

## Production Checklist

- [ ] All environment variables set in Vercel
- [ ] Firebase rules deployed (`firebase deploy --only firestore:rules`)
- [ ] CORS properly configured
- [ ] JWT secrets are strong (min 32 chars)
- [ ] Backend health check passes
- [ ] WebSocket connects from frontend
- [ ] Logging enabled for debugging
- [ ] Rate limiting configured
- [ ] HTTPS redirect enabled
