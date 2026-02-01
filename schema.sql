-- Friend CRM Schema for Neon PostgreSQL

-- Create the contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  display_name TEXT,
  message_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  received_count INTEGER DEFAULT 0,
  last_message_date TIMESTAMPTZ,
  is_saved_contact BOOLEAN DEFAULT false,
  category_id TEXT DEFAULT 'uncategorized',
  notes TEXT DEFAULT '',
  custom_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the settings table for storing column order and other preferences
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  category_order TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category_id);
CREATE INDEX IF NOT EXISTS idx_contacts_message_count ON contacts(message_count DESC);
