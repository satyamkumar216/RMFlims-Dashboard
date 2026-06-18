-- Supabase Schema for Bookings Table
-- Run this query in your Supabase SQL editor to create the bookings table and link it with enquiries and calendar_events.

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
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to avoid conflicts
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON bookings;

-- Create policy allowing authenticated users full access
CREATE POLICY "Allow full access for authenticated users" ON bookings FOR ALL USING (true) WITH CHECK (true);
