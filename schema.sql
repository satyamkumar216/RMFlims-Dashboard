-- Complete Supabase Schema for RMFlims Dashboard
-- Run this in your Supabase SQL editor to create all tables and setup security policies.

-- 1. ENQUIRIES TABLE
CREATE TABLE IF NOT EXISTS enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  package TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_end_date DATE,
  event_dates TEXT,
  message TEXT NOT NULL,
  agreed_price NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'confirmed', 'cancelled')) DEFAULT 'new',
  notes TEXT,
  location TEXT,
  payment_status TEXT CHECK (payment_status IN ('due', 'advance_paid', 'fully_paid')) DEFAULT 'due',
  payment_method TEXT,
  payment_timeline TEXT,
  paid_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CALENDAR EVENTS TABLE
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_end_date DATE,
  event_dates TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('marriage', 'brand_photoshoot', 'portfolio_shoot', 'model_shoot', 'reel_shoot', 'manual_shoot', 'blocked')),
  team_member TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL,
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('enquiry', 'manual')),
  client_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  how_found TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date_start DATE NOT NULL,
  event_date_end DATE NOT NULL,
  event_dates TEXT,
  location TEXT NOT NULL,
  package TEXT NOT NULL,
  package_details TEXT,
  num_guests INTEGER,
  agreed_price NUMERIC NOT NULL,
  advance_paid NUMERIC NOT NULL DEFAULT 0,
  balance_due NUMERIC NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('due', 'partial', 'paid')),
  payment_method TEXT NOT NULL,
  payment_terms TEXT NOT NULL,
  lead_photographer TEXT,
  second_shooter TEXT,
  videographer TEXT,
  special_requirements TEXT,
  booking_status TEXT NOT NULL CHECK (booking_status IN ('confirmed', 'in_progress', 'tentative', 'cancelled')),
  admin_notes TEXT,
  receipt_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON enquiries;
DROP POLICY IF EXISTS "Allow public insert for client website" ON enquiries;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON calendar_events;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON bookings;

-- Policies for ENQUIRIES
CREATE POLICY "Allow full access for authenticated users" ON enquiries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert for client website" ON enquiries FOR INSERT WITH CHECK (true);

-- Policies for CALENDAR EVENTS
CREATE POLICY "Allow full access for authenticated users" ON calendar_events FOR ALL USING (true) WITH CHECK (true);

-- Policies for BOOKINGS
CREATE POLICY "Allow full access for authenticated users" ON bookings FOR ALL USING (true) WITH CHECK (true);

-- 4. STAFF MEMBERS TABLE
CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  role_title TEXT NOT NULL,
  password TEXT DEFAULT '1234',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop old salary_requests table if it exists
DROP TABLE IF EXISTS salary_requests CASCADE;

-- 5. STAFF PAYMENTS TABLE (Replaces salary_requests)
CREATE TABLE IF NOT EXISTS staff_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  amount_given NUMERIC NOT NULL,
  admin_note TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entries_count INTEGER NOT NULL
);

-- 6. WORK LOG TABLE
CREATE TABLE IF NOT EXISTS work_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  event_title TEXT NOT NULL,
  event_date DATE NOT NULL,
  note TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
  payment_id UUID REFERENCES staff_payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. AGENCY CASH LEDGER TABLE
CREATE TABLE IF NOT EXISTS agency_cash_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('advance_received', 'salary_paid', 'expense', 'other_income')),
  amount NUMERIC NOT NULL,
  reference_id UUID,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_cash_ledger ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON staff_members;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON staff_payments;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON work_log;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON agency_cash_ledger;

-- Policies
CREATE POLICY "Allow full access for authenticated users" ON staff_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for authenticated users" ON staff_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for authenticated users" ON work_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for authenticated users" ON agency_cash_ledger FOR ALL USING (true) WITH CHECK (true);

