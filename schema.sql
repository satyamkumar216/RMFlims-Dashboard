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
