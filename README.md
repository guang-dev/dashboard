# Trading Dashboard

A production-ready trading dashboard system with admin and user portals.

## Features

- **Admin Portal**: Manage users, set beginning account values, input daily returns
- **User Portal**: View personalized dashboard with account summary and daily returns
- **Automatic Calculations**: Account values automatically calculated from daily returns
- **Trading Calendar**: Pre-configured with trading days for Oct-Dec 2025
- **Simple Authentication**: Database-backed login (no external auth service needed)

## Default Admin Credentials

- Username: `admin`
- Password: `admin123`

**⚠️ Important:** Change the admin password in the database before deploying to production!

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
dashboard/
├── app/
│   ├── admin/          # Admin dashboard
│   ├── dashboard/      # User dashboard
│   ├── api/            # API routes
│   └── page.tsx        # Login page
├── lib/
│   ├── db.ts           # Database initialization
│   ├── auth.ts         # Authentication logic
│   └── returns.ts      # Returns calculations
└── dashboard.db        # SQLite database (auto-created)
```

## Database Schema

### Users Table
- `id`: User ID
- `username`: Login username
- `password`: Login password (plain text - for simplicity)
- `first_name`: User's first name
- `last_name`: User's last name
- `beginning_value`: Starting account value
- `is_admin`: Admin flag (1 = admin, 0 = regular user)

### Daily Returns Table
- `id`: Return ID
- `date`: Trading date (YYYY-MM-DD)
- `percentage`: Daily return percentage

### Trading Calendar Table
- `id`: Calendar ID
- `date`: Trading date (YYYY-MM-DD)
- `is_half_day`: Half day flag (1 = half day, 0 = full day)

## How It Works

1. **Admin logs in** using admin credentials
2. **Admin creates users** by setting:
   - Username and password
   - First and last name
   - Beginning account value
3. **Admin inputs daily returns** (% gain/loss for each trading day)
4. **Users log in** with their credentials
5. **Users view their dashboard** showing:
   - Account summary with calculated current value
   - Daily returns for the current month
   - Running cumulative return for the month

## Calculations

- **Current Value** = Beginning Value × ∏(1 + daily_return%)
- **Change** = Current Value - Beginning Value
- **% Change** = (Change / Beginning Value) × 100
- **Month's Current Return** = Cumulative product of daily returns

## Security Notes

⚠️ **This is a simplified authentication system for demonstration purposes.**

For production use, consider:
- Hashing passwords (bcrypt, argon2)
- Using proper session management (JWT, secure cookies)
- Adding HTTPS
- Implementing rate limiting
- Adding CSRF protection
- Regular security audits

## Deployment

This application can be deployed to any platform that supports Node.js:

- **Vercel** (recommended for Next.js)
- **Netlify**
- **Railway**
- **Heroku**
- **VPS** (DigitalOcean, AWS, etc.)

Make sure to:
1. Set proper environment variables
2. Configure database backups
3. Change default admin password
4. Enable HTTPS

## Support

For issues or questions, please refer to the project documentation.
