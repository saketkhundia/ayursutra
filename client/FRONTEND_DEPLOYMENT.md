# Frontend Deployment Guide (Vercel/Netlify)

## Prerequisites

- ✅ Backend deployed on Vercel (get the URL)
- ✅ Vercel or Netlify account
- ✅ GitHub repo with frontend code

---

## Step 1: Get Your Backend URL

1. Go to [vercel.com](https://vercel.com) dashboard
2. Click your **ayursutra** backend project
3. Copy the deployment URL (e.g., `https://ayursutra-api.vercel.app`)

---

## Step 2: Configure Frontend Environment

Update your frontend environment variables:

**File**: `client/.env` (or `.env.production`)

```env
VITE_API_URL=https://your-backend-url.vercel.app/api
```

Example:
```env
VITE_API_URL=https://ayursutra-api.vercel.app/api
```

---

## Option A: Deploy to Vercel (Recommended)

### 1. Go to Vercel Dashboard
- [vercel.com](https://vercel.com)
- Click **Add New...** → **Project**

### 2. Import Your Repository
- Select your GitHub repo `saketkhundia/ayursutra`
- Click **Import**

### 3. Configure Project
- **Project Name**: `ayursutra-frontend`
- **Root Directory**: `client` ✅
- **Framework**: `Vite` (auto-detected)
- **Build Command**: `npm run build` ✅
- **Output Directory**: `dist` ✅
- **Install Command**: `npm install` ✅

### 4. Add Environment Variables
Click **Environment Variables** and add:

```
VITE_API_URL=https://your-backend-url.vercel.app/api
```

### 5. Deploy
Click **Deploy** and wait for completion.

**Your frontend URL**: `https://ayursutra-frontend.vercel.app`

---

## Option B: Deploy to Netlify (Alternative)

### 1. Go to Netlify
- [netlify.com](https://netlify.com)
- Click **Add new site** → **Import an existing project**

### 2. Connect GitHub
- Select your repository `saketkhundia/ayursutra`
- Click **Continue**

### 3. Configure Build Settings
- **Base directory**: `client`
- **Build command**: `npm run build`
- **Publish directory**: `dist`

### 4. Add Environment Variables
Click **Advanced** → **New variable**

```
VITE_API_URL = https://your-backend-url.vercel.app/api
```

### 5. Deploy
Click **Deploy site**

**Your frontend URL**: `https://ayursutra-frontend.netlify.app`

---

## Step 3: Update Backend CORS

After frontend is deployed, update your backend's CORS:

1. Go to Vercel → **ayursutra** backend project
2. Go to **Settings** → **Environment Variables**
3. Update `ALLOWED_ORIGINS`:

```
ALLOWED_ORIGINS=https://your-frontend-url.vercel.app,http://localhost:5173
```

Example:
```
ALLOWED_ORIGINS=https://ayursutra-frontend.vercel.app,http://localhost:5173
```

4. Redeploy backend (go to Deployments → Latest → Redeploy)

---

## Step 4: Verify Frontend Works

### Test 1: Frontend Loads
```bash
curl https://your-frontend-url.vercel.app
```

### Test 2: API Connection
Open frontend in browser and check:
1. Browser DevTools → **Network** tab
2. Make a request (login, fetch doctors, etc.)
3. Should see requests to your backend URL
4. Should NOT see CORS errors

### Test 3: WebSocket Connection
1. Open DevTools → **Console**
2. Look for WebSocket connection message
3. Should connect to `wss://your-backend-url.vercel.app`

---

## Frontend File to Update

**File**: [client/src/api.ts](client/src/api.ts)

Make sure it uses environment variable:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
```

This should automatically pick up the `VITE_API_URL` from your deployment environment.

---

## Troubleshooting

### Build Fails: "Cannot find module"
- Check `client/package.json` has all dependencies
- Run `npm install` locally to verify
- Check Node version matches (Node 18+)

### CORS Errors
- Verify backend's `ALLOWED_ORIGINS` includes your frontend URL
- Check backend was redeployed after updating CORS
- Frontend URL must match exactly (including `https://`)

### API Calls Return 404
- Verify `VITE_API_URL` is set correctly
- Check backend is running and deployed
- Test backend health: `curl https://your-backend-url/api/health`

### WebSocket Connection Fails
- Check backend `ALLOWED_ORIGINS` includes frontend URL
- Check backend is running (not sleeping on free tier)
- Check browser console for specific error

---

## Next Steps

1. ✅ Deploy backend to Vercel
2. ✅ Deploy frontend to Vercel/Netlify
3. ⏭️ Deploy ML service to Railway
4. ⏭️ Set up custom domain (optional)
5. ⏭️ Configure Firebase security rules

---

## Deployment URLs Summary

| Service | URL | Status |
|---------|-----|--------|
| Frontend | `https://ayursutra-frontend.vercel.app` | ⏳ |
| Backend | `https://ayursutra-api.vercel.app/api` | ✅ |
| ML Service | `https://ayursutra-ml.railway.app` | ⏳ |
