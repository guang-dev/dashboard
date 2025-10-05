# Deployment Guide

## Overview

This Next.js application can be deployed to various platforms. Below are instructions for the most common deployment options.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git (for most deployment platforms)

## Option 1: Vercel (Recommended)

Vercel is the easiest way to deploy Next.js applications.

### Steps:

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Follow the prompts** and your app will be deployed!

### Important Notes:
- SQLite database will work but won't persist across deployments
- Consider using a persistent database for production (PostgreSQL, MySQL)
- Set environment variables in Vercel dashboard if needed

## Option 2: Traditional VPS (DigitalOcean, AWS, etc.)

### Steps:

1. **SSH into your server**:
   ```bash
   ssh user@your-server-ip
   ```

2. **Install Node.js** (if not installed):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone or upload your project**:
   ```bash
   git clone <your-repo-url>
   cd dashboard
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Build the application**:
   ```bash
   npm run build
   ```

6. **Install PM2** (process manager):
   ```bash
   sudo npm install -g pm2
   ```

7. **Start the application**:
   ```bash
   pm2 start npm --name "dashboard" -- start
   pm2 save
   pm2 startup
   ```

8. **Set up Nginx as reverse proxy** (optional but recommended):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

9. **Enable HTTPS with Let's Encrypt**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Option 3: Docker

### Create Dockerfile:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### Create docker-compose.yml:

```yaml
version: '3.8'

services:
  dashboard:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./dashboard.db:/app/dashboard.db
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### Deploy:

```bash
docker-compose up -d
```

## Option 4: Railway

Railway is a simple deployment platform with excellent Next.js support.

### Steps:

1. **Push your code to GitHub** (see instructions above for authentication)

2. **Go to [railway.app](https://railway.app)** and sign in with GitHub

3. **Create new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `dashboard` repository

4. **Configure deployment**:
   Railway will auto-detect Next.js configuration from `railway.json` and `nixpacks.toml`

5. **🔴 IMPORTANT: Add a persistent volume for SQLite data**:
   - Click on your deployed service
   - Go to "Settings" tab
   - Scroll to "Volumes" section
   - Click "New Volume"
   - **Mount Path**: `/app/data`
   - Click "Add"

   This ensures your database persists across deployments!

6. **Set environment variables**:
   - Click on your service
   - Go to "Variables" tab
   - Add: `NODE_ENV=production`

7. **Deploy**:
   - Railway will automatically build and deploy
   - You'll get a URL like `https://your-app.up.railway.app`

### Important Notes for Railway:
- ✅ **SQLite with persistent volume**: This app is configured to use `/app/data` for database storage
- The volume setup in step 5 is **REQUIRED** for data persistence
- Without the volume, all data (users, returns) will be lost on each deployment
- The `railway.json` and `nixpacks.toml` files are already configured
- Automatic deployments trigger on every git push to main branch
- Free tier available with limited hours/month

### Alternative: PostgreSQL (More Scalable)
If you prefer PostgreSQL instead:
1. Click "New" → "Database" → "Add PostgreSQL"
2. Update `lib/db.ts` to use PostgreSQL instead of SQLite
3. Railway will provide a `DATABASE_URL` environment variable automatically

## Option 5: Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your Git repository
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Deploy!

## Database Considerations

### SQLite (Default)
- ✅ Simple, no setup required
- ✅ Good for small-medium traffic
- ❌ Doesn't scale horizontally
- ❌ May not persist on some platforms

### PostgreSQL (Recommended for Production)
To switch to PostgreSQL:

1. Install `pg` package:
   ```bash
   npm install pg
   ```

2. Update `lib/db.ts` to use PostgreSQL instead of SQLite

3. Set `DATABASE_URL` environment variable

## Security Checklist

Before going to production:

- [ ] Change default admin password
- [ ] Enable HTTPS
- [ ] Hash passwords (implement bcrypt)
- [ ] Add rate limiting
- [ ] Set up proper session management
- [ ] Configure CORS properly
- [ ] Add CSRF protection
- [ ] Set up database backups
- [ ] Configure environment variables
- [ ] Add logging and monitoring
- [ ] Set up error tracking (Sentry, etc.)

## Environment Variables

Create `.env.local` for local development or set in your hosting platform:

```bash
NODE_ENV=production
DATABASE_URL=your-database-url (if using external DB)
```

## Monitoring

### Recommended Tools:
- **Uptime monitoring**: UptimeRobot, Pingdom
- **Error tracking**: Sentry
- **Analytics**: Google Analytics, Plausible
- **Performance**: Vercel Analytics, New Relic

## Backup Strategy

### SQLite:
```bash
# Backup
cp dashboard.db dashboard.db.backup

# Restore
cp dashboard.db.backup dashboard.db
```

### Automated backups:
```bash
# Add to crontab
0 2 * * * cp /path/to/dashboard.db /path/to/backups/dashboard-$(date +\%Y\%m\%d).db
```

## Troubleshooting

### Port already in use:
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Build fails:
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Database locked:
```bash
# Stop all instances
pm2 stop dashboard

# Restart
pm2 start dashboard
```

## Performance Optimization

1. **Enable caching**:
   - Configure CDN (Cloudflare, etc.)
   - Set proper cache headers

2. **Optimize images**:
   - Use Next.js Image component
   - Compress images

3. **Database optimization**:
   - Add indexes
   - Connection pooling
   - Query optimization

4. **Monitoring**:
   - Set up performance monitoring
   - Track slow queries
   - Monitor memory usage

## Support

For deployment issues:
- Check Next.js deployment docs
- Check your hosting platform docs
- Review build logs for errors

Good luck with your deployment! 🚀
