# ML Service Deployment Guide - Render

## Why Render?

- ✅ Perfect for Python/Flask applications
- ✅ Free tier available ($0/month, sleeps after 15 min of inactivity)
- ✅ Paid tier very affordable ($7/month for always-on)
- ✅ Auto-deploys from GitHub
- ✅ Environment variables management
- ✅ Custom domains
- ✅ PostgreSQL database included (if needed)

---

## Prerequisites

- ✅ GitHub account with repo pushed
- ✅ Render account (free at [render.com](https://render.com))
- ✅ Backend deployed on Vercel (to get the URL)

---

## Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Click **Sign Up**
3. Sign up with GitHub (recommended)
4. Grant permissions to access your repositories

---

## Step 2: Deploy ML Service to Render

### Method 1: Via Render Dashboard (Recommended)

1. Go to [render.com](https://render.com) dashboard
2. Click **New +** button in top right
3. Select **Web Service**
4. Click **Connect a repository**
5. Search for and select: `saketkhundia/ayursutra`
6. Click **Connect**

### Configure the Service

1. **Name**: `ayursutra-ml`
2. **Environment**: `Python 3`
3. **Region**: Choose closest to your users (e.g., `Oregon`)
4. **Branch**: `main`
5. **Root Directory**: `ml-service` ⭐ **IMPORTANT**
6. **Build Command**: 
   ```
   pip install -r requirements.txt
   ```
7. **Start Command**: 
   ```
   python app.py
   ```
   Or:
   ```
   flask run --host=0.0.0.0 --port=10000
   ```
8. **Plan**: Free (or Starter $7/month for always-on)

9. Click **Create Web Service**

---

## Step 3: Configure Environment Variables

1. In Render dashboard, click your **ayursutra-ml** service
2. Go to **Environment** tab
3. Add variables if needed (usually none for basic service):
   ```
   FLASK_ENV=production
   FLASK_DEBUG=false
   ```
4. Save/redeploy

---

## Step 4: Get Your ML Service URL

After deployment completes:

1. In Render dashboard, click your service
2. Look for **URL** at the top (blue link)
3. Example: `https://ayursutra-ml.onrender.com`

⚠️ **Note**: Free tier sleeps after 15 min of inactivity. First request takes 30 sec to wake up.

---

## Step 5: Update Backend with ML URL

Your backend needs to know where the ML service is:

1. Go to Vercel → **ayursutra** backend project
2. **Settings** → **Environment Variables**
3. Update `ML_SERVICE_URL`:
   ```
   ML_SERVICE_URL=https://your-render-ml-url
   ```
   Example:
   ```
   ML_SERVICE_URL=https://ayursutra-ml.onrender.com
   ```
4. **Redeploy** backend (Deployments → Latest → Redeploy)

---

## Step 6: Test ML Service

### Test 1: Service is Running
```bash
curl https://your-render-ml-url/
```

Should return:
```json
{
  "status": "ok",
  "service": "AyurSutra ML Service"
}
```

### Test 2: Test Recommendation Endpoint
```bash
curl https://your-render-ml-url/recommend \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"dosha":"vata"}'
```

### Test 3: Backend Can Reach It

Once backend is redeployed:
1. Make a request from frontend that uses ML features
2. Check Render logs for errors
3. Should work without CORS issues

---

## Step 7: Check Deployment Logs

1. In Render dashboard, click your service
2. Go to **Logs** tab
3. Watch for any errors during build or runtime

Common issues in logs:
- `ModuleNotFoundError: No module named 'flask'`
- `Port is already in use`
- `Cannot find requirements.txt`

---

## Troubleshooting

### Build Fails: "Cannot find requirements.txt"
- Make sure **Root Directory** is set to `ml-service`
- Verify `ml-service/requirements.txt` exists in your repo
- Push changes to GitHub and redeploy

### Service Won't Start
Check logs for errors. Common fixes:

```bash
# If using port 5000 (might not work on Render)
# Use port 10000 instead:
flask run --host=0.0.0.0 --port=10000
```

Update **Start Command** to:
```
python app.py
```

Or for Flask:
```
gunicorn -w 4 -b 0.0.0.0:10000 app:app
```

### Backend Can't Connect to ML Service
1. Verify `ML_SERVICE_URL` is set in Vercel
2. Verify URL is correct (copy from Render dashboard)
3. Test URL manually: `curl https://your-url/`
4. Wait 30 seconds if using free tier (might be sleeping)
5. Redeploy backend after updating URL

### Cold Start Delays (Free Tier)
- Free tier sleeps after 15 minutes of inactivity
- First request takes ~30 seconds to wake up
- Upgrade to **Starter** ($7/month) for always-on service
- Or use Railway instead (better for free tier)

---

## File Structure Check

Your repo should have:

```
ayursutra/
├── ml-service/                  ← Root Directory
│   ├── app.py                   ✅ Flask app
│   ├── requirements.txt         ✅ Dependencies
│   ├── personalization_engine.py
│   ├── scheduling_engine.py
│   ├── Dockerfile              (optional)
│   └── venv/                   (in .gitignore)
├── server/
├── client/
└── .github/
```

---

## Start Command Examples

Choose ONE based on your setup:

### Option 1: Direct Python (Simplest)
```
python app.py
```

### Option 2: Flask Development
```
flask run --host=0.0.0.0 --port=10000
```

### Option 3: Gunicorn (Production)
```
gunicorn -w 4 -b 0.0.0.0:10000 app:app
```

⚠️ For gunicorn, add to `requirements.txt`:
```
gunicorn==20.1.0
```

---

## Deployment URLs Summary

| Service | Platform | URL | Status |
|---------|----------|-----|--------|
| Frontend | Vercel | `https://ayursutra-frontend.vercel.app` | ✅ |
| Backend | Vercel | `https://ayursutra-api.vercel.app/api` | ✅ |
| ML Service | Render | `https://ayursutra-ml.onrender.com` | ⏳ |

---

## Free vs Paid on Render

| Feature | Free | Starter ($7/mo) |
|---------|------|-----------------|
| Always On | ❌ Sleeps | ✅ Yes |
| Auto-redeploy | ✅ | ✅ |
| Custom domain | ❌ | ✅ |
| Public URL | ✅ | ✅ |
| Best for | Testing | Production |

---

## After Deployment Complete

1. ✅ Frontend deployed on Vercel
2. ✅ Backend deployed on Vercel
3. ✅ ML service deployed on Render
4. ⏭️ Test end-to-end workflow
5. ⏭️ Upgrade Render to Starter if production use
6. ⏭️ Set up custom domains (optional)
7. ⏭️ Configure Firebase security rules
8. ⏭️ Monitor logs and performance

---

## Quick Reference: Render Setup

| Step | Action |
|------|--------|
| 1 | Sign up at render.com with GitHub |
| 2 | New Web Service → Connect repo |
| 3 | Set Root Directory to **ml-service** |
| 4 | Build: `pip install -r requirements.txt` |
| 5 | Start: `python app.py` |
| 6 | Deploy and get URL |
| 7 | Update backend `ML_SERVICE_URL` |
| 8 | Redeploy backend on Vercel |
| 9 | Test the connection |

---

## Need Help?

- **Render Docs**: https://render.com/docs
- **Flask Deployment**: https://flask.palletsprojects.com/deployment/
- **Check Logs**: Always check Render's Logs tab first when troubleshooting
