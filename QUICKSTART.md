# Quick Start Guide

## 1. Start the Application

```bash
npm run dev
```

The application will be available at http://localhost:3000

## 2. Login as Admin

- **URL**: http://localhost:3000
- **Username**: `admin`
- **Password**: `admin123`

## 3. Create Your First User

On the admin dashboard:

1. Fill in the "Add User" form:
   - **Username**: testuser
   - **Password**: password123
   - **First Name**: John
   - **Last Name**: Doe
   - **Beginning Value**: 100000
2. Click "Add User"

## 4. Add Daily Returns

On the admin dashboard, in the "Daily Returns" section:

1. Select a date (must be a trading day from Oct-Dec 2025)
2. Enter a percentage (e.g., `1.5` for +1.5% or `-0.8` for -0.8%)
3. Click "Add Return"

The return will be applied to all user accounts automatically.

## 5. Login as a User

1. Logout from admin (click "Logout" button)
2. Login with the user credentials:
   - **Username**: testuser
   - **Password**: password123

You'll see the user's personalized dashboard with:
- Account summary showing calculated values
- Daily returns for the current month
- Running cumulative return

## Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Important Security Steps

Before deploying to production:

1. **Change the admin password**:
   - Delete `dashboard.db`
   - Edit `lib/db.ts` and change the default admin password
   - Rebuild the application

2. **Add environment variables** (create `.env.local`):
   ```
   NODE_ENV=production
   ```

3. **Enable HTTPS** on your hosting platform

4. **Consider implementing**:
   - Password hashing
   - JWT or session-based auth
   - Rate limiting
   - CSRF protection

## Troubleshooting

### Database not created?
- Make sure the app has write permissions in the project directory
- Check if `dashboard.db` exists after first run

### Can't login?
- Verify you're using the correct credentials
- Check browser console for errors
- Clear sessionStorage and try again

### Daily returns not showing?
- Verify the date is in the trading calendar (Oct-Dec 2025)
- Check that returns were added via admin panel
- Ensure you're viewing the correct month

## Features Overview

### Admin Can:
- Create users with custom beginning values
- Delete users
- Input daily returns for any trading day
- View all users and their data

### Users Can:
- View their account summary
- See daily returns for current month
- See running cumulative return
- View which days are half-days

### Automatic Calculations:
- Current Value = Beginning Value × product of (1 + each daily return %)
- Change = Current Value - Beginning Value
- % Change = (Change / Beginning Value) × 100
- Month's Return = Cumulative product of daily returns - 1

Enjoy your trading dashboard!
