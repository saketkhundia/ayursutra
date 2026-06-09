# ML Service Deployment Guide (Railway)

## Why Railway?

- ✅ Perfect for Python/Flask applications
- ✅ Free tier with $5/month credits
- ✅ Auto-deploys from GitHub
- ✅ Supports long-running processes
- ✅ Environment variables management
- ✅ Custom domains

---

## Prerequisites

- ✅ GitHub account with repo pushed
- ✅ Railway account (free at [railway.app](https://railway.app))
- ✅ Backend deployed on Vercel (to get the URL)

---

## Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click **Sign Up**
3. Sign up with GitHub (recommended)
4. Grant permissions

---

## Step 2: Deploy ML Service to Railway

### Option A: Via Railway Dashboard (Recommended)

1. Go to [railway.app](https://railway.app) dashboard
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Select your repo: `saketkhundia/ayursutra`
5. Select **ml-service** directory
6. Click **Deploy**

Railway will automatically:
- ✅ Detect `requirements.txt`
- ✅ Detect `app.py`
- ✅ Install Python dependencies
- ✅ Start the Flask application

### Option B: Via Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Navigate to ml-service
cd ml-service

# Deploy
railway up

# View logs
railway logs
```

---

## Step 3: Configure Environment Variables (if needed)

1. Go to Railway dashboard
2. Click your **ayursutra-ml** project
3. Go to **Variables** tab
4. Add any environment variables if needed (usually none for basic ML service)

---

## Step 4: Get Your ML Service URL

1. In Railway dashboard, click your project
2. Go to **Settings**
3. Find **Public Networking** or **Domains**
4. Copy the generated URL (e.g., `https://ayursutra-ml-production.up.railway.app`)

---

## Step 5: Update Backend with ML URL

Your backend needs to know where the ML service is:

1. Go to Vercel → **ayursutra** backend project
2. **Settings** → **Environment Variables**
3. Update `ML_SERVICE_URL`:
   ```
   ML_SERVICE_URL=https://your-railway-ml-url
   ```
   Example:
   ```
   ML_SERVICE_URL=https://ayursutra-ml-production.up.railway.app
   ```
4. **Redeploy** backend (Deployments → Latest → Redeploy)

---

## Step 6: Test ML Service

### Test 1: ML Service is Running
```bash
curl https://your-railway-ml-url/
```

Should return something like:
```json
{
  "status": "ok",
  "service": "AyurSutra ML Service"
}
```

### Test 2: Test API Endpoint
```bash
curl https://your-railway-ml-url/recommend \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"dosha":"vata"}'
```

### Test 3: Backend Can Reach ML Service

Once backend is redeployed with new `ML_SERVICE_URL`:
1. Make a request from frontend that triggers ML recommendations
2. Check backend logs for any ML service errors
3. Should work without CORS issues (backend to backend call)

---

## Troubleshooting

### Build Fails: "No module named 'flask'"
- Railway couldn't install dependencies
- Check `ml-service/requirements.txt` exists
- Verify it has all dependencies listed

### Service Won't Start
1. Check Railway logs:
   - Go to project → **Logs** tab
   - Look for error messages
2. Common issues:
   - Missing `app.py` in root of ml-service directory
   - Port not configured correctly
   - Check that Flask app is running on correct port

### Backend Can't Connect to ML Service
- Verify `ML_SERVICE_URL` is set in backend environment
- Verify URL is correct (check Railway dashboard)
- Test URL manually with `curl`
- Make sure backend was redeployed after updating URL

### ML Service Slow/Timing Out
- Railway free tier has limitations
- Check logs for slow operations
- Consider upgrading Railway plan if needed

---

## File Structure Check

Your `ml-service/` should have:

```
ml-service/
├── app.py                          ✅ Main Flask app
├── requirements.txt                ✅ Python dependencies
├── personalization_engine.py       ✅ Recommendation logic
├── scheduling_engine.py            ✅ Scheduling logic
├── Dockerfile                      (optional)
└── venv/                           (should be in .gitignore)
```

---

## Deployment URLs Summary

| Service | URL | Status |
|---------|-----|--------|
| Frontend | `https://ayursutra-frontend.vercel.app` | ✅ |
| Backend | `https://ayursutra-api.vercel.app/api` | ✅ |
| ML Service | `https://your-ml.railway.app` | ⏳ |

---

## After Deployment Complete

1. ✅ Frontend deployed on Vercel
2. ✅ Backend deployed on Vercel
3. ✅ ML service deployed on Railway
4. ⏭️ Test end-to-end workflow
5. ⏭️ Set up custom domain (optional)
6. ⏭️ Configure Firebase security rules
7. ⏭️ Monitor logs and performance

---

## Alternative: Deploy to Render

If you prefer Render instead:

1. Go to [render.com](https://render.com)
2. New → **Web Service**
3. Connect GitHub repo
4. Select **Python** environment
5. Build command: `pip install -r ml-service/requirements.txt`
6. Start command: `python ml-service/app.py`
7. Deploy

Similar process to Railway but with Render's interface.

---

## Quick Reference: Railway Setup

| Step | Action |
|------|--------|
| 1 | Sign up at railway.app |
| 2 | Create new project from GitHub |
| 3 | Select ml-service directory |
| 4 | Let Railway auto-deploy |
| 5 | Get public URL from dashboard |
| 6 | Update backend ML_SERVICE_URL |
| 7 | Redeploy backend |
| 8 | Test end-to-end |
