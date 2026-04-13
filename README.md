# Personal Credit/Debit Manager

Full-stack Next.js (App Router) application to track personal dues, credits, debits, reminders and exports.

## Tech Stack

- Next.js 16 (App Router)
- MongoDB + Mongoose
- Tailwind CSS v4
- JWT auth with secure httpOnly cookie session
- Resend for emails
- node-cron for automatic reminders
- PDFKit + html-to-image for exports

## Core Features

- Authentication (signup, login, logout)
- Dashboard with totals, pending dues, paid history, charts
- Person management
- Transactions with filters, search, date range, status
- Due management and mark as paid
- Bin management with 3-year restore window
- Reminder emails and summary notifications
- PDF + CSV + JPG export
- Multi-currency transaction support
- WhatsApp share link
- Activity logs

## Setup

1. Install dependencies

```bash
npm install
```

2. Create environment file

```bash
copy .env.example .env.local
```

3. Fill MongoDB and SMTP values in .env.local

4. Run dev server

```bash
npm run dev
```

5. Open http://localhost:3000

## Important Environment Variables

- MONGODB_URI
- JWT_SECRET
- RESEND_API_KEY
- RESEND_FROM
- ENABLE_CRON

## API Routes

- /api/auth/signup
- /api/auth/login
- /api/auth/logout
- /api/auth/me
- /api/person
- /api/person/:id
- /api/transaction
- /api/transaction/:id
- /api/dashboard
- /api/reminder
- /api/reminder/settings
- /api/bin/person
- /api/bin/person/:id/restore
- /api/bin/transaction
- /api/bin/transaction/:id/restore
- /api/export/pdf
- /api/export

## Deployment Notes

- For automatic reminders in production, use an external scheduler to hit /api/reminder (or enable a persistent Node process with ENABLE_CRON=true).
- Set strong JWT secrets and production SMTP credentials.
