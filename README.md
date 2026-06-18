# RM Films — Admin Dashboard

A Next.js admin dashboard for managing wedding photography enquiries, bookings, and calendar events. Built with Supabase as the backend.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database & Auth:** Supabase (PostgreSQL + Auth)
- **Styling:** Tailwind CSS 4
- **Language:** TypeScript

## Deployment Checklist

Follow these steps to deploy the dashboard from scratch:

### 1. Set Up Supabase

- [ ] Create a new project at [supabase.com](https://supabase.com)
- [ ] Open the SQL Editor in your Supabase dashboard
- [ ] Run the SQL schema from `schema.sql` to create the `bookings` table
- [ ] Also create the `enquiries` and `calendar_events` tables if not already present

### 2. Get Your Credentials

- [ ] In Supabase, go to **Settings → API**
- [ ] Copy the **Project URL** (`https://xxxxx.supabase.co`)
- [ ] Copy the **anon / public** API key

### 3. Configure Environment Variables Locally

- [ ] Copy `.env.example` to `.env.local`:
  ```bash
  cp .env.example .env.local
  ```
- [ ] Open `.env.local` and paste your real Supabase URL and anon key

### 4. Install & Test Locally

```bash
npm install
npm run dev
```

- [ ] Open [http://localhost:3000](http://localhost:3000) and verify the dashboard loads
- [ ] Log in with your Supabase Auth credentials

### 5. Push to GitHub

- [ ] Commit all code (`.env.local` is already in `.gitignore` — your keys will not be pushed)
- [ ] Push to your GitHub repository

### 6. Deploy on Vercel

- [ ] Import your GitHub repo on [vercel.com](https://vercel.com)
- [ ] Under **Project Settings → Environment Variables**, add:
  | Variable | Value |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |
- [ ] Deploy

### 7. Verify Deployment

- [ ] Visit `/diagnostics` on your live deployed URL
- [ ] Confirm all 6 health checks show green ✓
- [ ] Click **"Send Test Enquiry"** and confirm the row appears in:
  - The Supabase `enquiries` table
  - The dashboard inbox
- [ ] Click **"Delete All Test Enquiries"** to clean up test data

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key |

See `.env.example` for the template.

## Project Structure

```
src/
├── app/
│   ├── dashboard/          # Main dashboard pages (auth-protected)
│   │   ├── bookings/       # Bookings management
│   │   ├── calendar/       # Calendar view
│   │   ├── enquiries/      # Enquiry details
│   │   ├── layout.tsx      # Dashboard sidebar layout
│   │   └── page.tsx        # Dashboard home (enquiries list)
│   ├── diagnostics/        # Deployment health check page
│   ├── login/              # Login page
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Root redirect → /dashboard
├── middleware.ts           # Auth middleware
└── utils/
    └── supabase/
        ├── client.ts       # Browser Supabase client (shared)
        ├── demo.ts         # Demo mode data
        └── middleware.ts   # Supabase session middleware
```

## Demo Mode

If no Supabase credentials are configured, the dashboard automatically runs in **Demo Mode** using local storage. This lets you preview the full UI without a database. Log in with:

- **Email:** `admin@rmfilms.com`
- **Password:** `admin123`
