# Deployment Guide - Render

This guide explains how to deploy the **Business Sales Analyzer** application globally using Render.

## Why Render?

- ✅ **Free tier** available
- ✅ **Docker support** - Deploy containerized apps easily
- ✅ **Auto-deploy** from GitHub
- ✅ **Global CDN** - Fast access worldwide
- ✅ **Easy environment variables** management
- ✅ **Custom domains** support

---

## Prerequisites

1. **GitHub Repository** - Your code must be pushed to GitHub ✓ (Already done!)
2. **Render Account** - Sign up at https://render.com
3. **OpenAI API Key** - Get from https://platform.openai.com/api-keys (optional, but required for AI features)

---

## Step-by-Step Deployment

### Step 1: Create a Render Account

1. Go to https://render.com
2. Click **Sign Up** and create an account using GitHub (recommended)
3. Authorize Render to access your GitHub repositories

### Step 2: Create a New Web Service

1. Dashboard → Click **+ New**
2. Select **Web Service**
3. Select your GitHub repository: `Bussines-Sales-Analyzer`
4. Click **Connect**

### Step 3: Configure the Service

Fill in the following details:

| Field | Value |
|-------|-------|
| **Name** | `sales-analyzer` (or your preferred name) |
| **Environment** | `Docker` |
| **Region** | Select closest to your location |
| **Plan** | `Free` (or `Starter` for better performance) |
| **Branch** | `main` |

### Step 4: Set Environment Variables

1. Scroll down to **Environment**
2. Add these variables:

```
FLASK_ENV=production
FLASK_APP=app.py
SECRET_KEY=<generate-a-secure-random-key>
OPENAI_API_KEY=<your-openai-api-key>
```

**How to generate SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 5: Deploy

1. Click **Create Web Service**
2. Render will:
   - Build your Docker image
   - Run tests
   - Deploy to production

3. Wait for the deployment to complete (usually 2-5 minutes)
4. Your app will be available at: `https://<service-name>.onrender.com`

---

## Post-Deployment Steps

### Enable Auto-Deploy from GitHub

1. Go to your Render dashboard
2. Select your service
3. Settings → Auto-Deploy → Select `main` branch
4. Save

Now, every push to the `main` branch on GitHub will automatically redeploy your app!

### Add a Custom Domain (Optional)

1. Dashboard → Your Service → Settings
2. Scroll to **Custom Domain**
3. Add your domain: `yourdomain.com`
4. Update DNS records as instructed

---

## Troubleshooting

### Issue: Build Fails

**Solution:**
- Check Render logs: Dashboard → Your Service → Logs
- Ensure all dependencies in `backend/requirements.txt` are compatible
- Verify environment variables are set

### Issue: Service Crashes After Deployment

**Solution:**
- Check Render logs for errors
- Verify `OPENAI_API_KEY` is set if using AI features
- Ensure SECRET_KEY is configured

### Issue: Need to See Logs

1. Dashboard → Your Service
2. Click **Logs** tab
3. Real-time logs will display

---

## Monitoring & Maintenance

### View Logs
- Dashboard → Your Service → Logs

### Check Service Health
- Dashboard → Your Service → Health

### Redeploy
- Dashboard → Your Service → Manual Deploy

### Update Environment Variables
- Settings → Environment → Edit and save

---

## Performance Tips

1. **Enable Auto-Scaling** (Starter plan+): More instances under traffic
2. **Monitor Logs** for errors and optimize slow endpoints
3. **Cache Database Queries** where possible
4. **Use CDN** for static files (CSS, JS)

---

## Cost Breakdown (Free Tier)

- **Web Service**: Free ($0)
- **Storage**: Included
- **Bandwidth**: 100 GB/month
- **Limits**: 
  - Services spin down after 15 min of inactivity
  - Available 750 compute hours/month per free service

**Upgrade to Starter Plan ($7/mo) for:**
- Always-on service (no spin-down)
- Better performance
- More reliability

---

## Next Steps

1. ✅ Deploy to Render
2. ✅ Test all features at your deployment URL
3. ✅ Add custom domain (optional)
4. ✅ Monitor logs for issues
5. ✅ Share with users worldwide! 🌍

---

## Support

- **Render Docs**: https://render.com/docs
- **GitHub Issues**: Report bugs in your repository
- **Questions**: Check Render Community: https://render.com/community

---

**Good luck with your deployment! 🚀**
