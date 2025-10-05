# Railway Deployment Setup Guide

This is a step-by-step guide to deploy your dashboard to Railway with persistent SQLite storage.

## Prerequisites

- ✅ Code pushed to GitHub (`guang-dev/dashboard`)
- ✅ Railway account (sign up at https://railway.app)

## Deployment Steps

### 1. Create New Project

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose **`guang-dev/dashboard`**

Railway will automatically:
- Detect it's a Next.js app
- Use the `railway.json` and `nixpacks.toml` configs
- Start building and deploying

### 2. ⚠️ CRITICAL: Add Persistent Volume

**Without this step, all your data will be lost on every deployment!**

1. Click on your deployed service (the container icon)
2. Click **"Settings"** tab at the top
3. Scroll down to **"Volumes"** section
4. Click **"+ New Volume"**
5. Configure:
   - **Mount Path**: `/app/data`
   - Leave other settings as default
6. Click **"Add"**

✅ This creates persistent storage for your SQLite database

### 3. Set Environment Variable

1. While in your service, click **"Variables"** tab
2. Click **"+ New Variable"**
3. Add:
   - **Key**: `NODE_ENV`
   - **Value**: `production`
4. Click **"Add"**

### 4. Deploy (Redeploy if needed)

If the volume was added after first deployment:
1. Go to **"Deployments"** tab
2. Click the ⋮ menu on the latest deployment
3. Click **"Redeploy"**

### 5. Access Your App

1. Go to **"Settings"** tab
2. Scroll to **"Domains"**
3. Click **"Generate Domain"**
4. You'll get a URL like: `https://dashboard-production-xxxx.up.railway.app`

## Default Login

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Change this immediately after first login!**

## How Data Persistence Works

```
Local Development:
database.db → stored in project root

Railway Production:
database.db → stored in /app/data (persistent volume)
```

- Volume survives deployments
- Data persists even when you push new code
- Backups are your responsibility (see below)

## Testing Persistence

1. Log in and create a test user
2. Push a small code change to GitHub
3. Railway auto-deploys the new version
4. Log in again - your test user should still exist ✅

## Future Deployments

Once set up, deployments are automatic:
1. Make code changes locally
2. Commit: `git add . && git commit -m "Your message"`
3. Push: `git push`
4. Railway automatically builds and deploys
5. **Your data persists** because of the volume! ✅

## Database Backups (Recommended)

Railway volumes are persistent but should be backed up:

### Option 1: Manual Backup via Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# SSH into your service
railway run bash

# Backup database
cp /app/data/dashboard.db /tmp/backup.db
# Then download using scp or other method
```

### Option 2: Add Backup Endpoint (Future Enhancement)

Create an admin endpoint that:
1. Creates a database backup
2. Downloads it as a file
3. Run this weekly/monthly

## Troubleshooting

### Data keeps disappearing after deployment
- ✅ Check volume is mounted at `/app/data`
- ✅ Check `NODE_ENV=production` is set
- ✅ Redeploy after adding volume

### Build fails
- Check Railway logs in "Deployments" tab
- Ensure `package.json` dependencies are correct

### Database errors
- Check `/app/data` directory exists in production
- View logs: `railway logs`

## Monitoring

- **Logs**: Click "Deployments" → Select deployment → View logs
- **Metrics**: Railway dashboard shows CPU/Memory usage
- **Uptime**: Use external monitoring (UptimeRobot, etc.)

## Costs

- **Free Tier**: $5/month credit (500 hours)
- **Hobby Plan**: $5/month
- **Pro Plan**: $20/month

Your app should fit within free tier for development!

## Next Steps

- [ ] Deploy to Railway
- [ ] Add persistent volume
- [ ] Test data persistence
- [ ] Change admin password
- [ ] Set up backups
- [ ] Add custom domain (optional)

---

Need help? Check Railway docs: https://docs.railway.app
