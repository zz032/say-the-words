-- Run this SQL in your Supabase SQL Editor to create the required tables.
-- Go to: Supabase Dashboard > SQL Editor > New Query
-- For existing projects: run the migration section at the bottom instead.

-- Create table if missing and ensure an initial row (id = 1)
CREATE TABLE IF NOT EXISTS room_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO room_config (id, admin_id, updated_at)
VALUES (1, NULL, now())
ON CONFLICT (id) DO NOTHING;

-- Participants: admin (1) + speaker (1) + listeners (up to 10). Max 11 = speaker + listeners.
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'speaker', 'listener')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages: speaker/admin messages visible to all, listener messages visible only to speaker/admin
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'speaker', 'listener')),
  sender_user_id TEXT NOT NULL,
  reply_to UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - allow all for MVP simplicity
ALTER TABLE room_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development; use DROP ... IF EXISTS first to avoid errors
DROP POLICY IF EXISTS "Allow all on room_config" ON room_config;
CREATE POLICY "Allow all on room_config" ON room_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on participants" ON participants;
CREATE POLICY "Allow all on participants" ON participants FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on messages" ON messages;
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- If adding reply_to after initial deploy, ensure column exists
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID NULL;

-- Archives: store exported chat rounds and metadata for admin inspection
CREATE TABLE IF NOT EXISTS archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT,
  participant_count INT DEFAULT 0,
  speaker_change_count INT DEFAULT 0,
  participants JSONB,
  messages JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime: Go to Supabase Dashboard > Database > Replication
-- and add "participants", "messages", "room_config" to the supabase_realtime publication.

-- ========== MIGRATION (if you have existing tables) ==========
-- Run this if upgrading from the previous schema:
/*
ALTER TABLE participants RENAME COLUMN session_id TO user_id;
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_role_check;
ALTER TABLE participants ADD CONSTRAINT participants_role_check CHECK (role IN ('admin', 'speaker', 'listener'));

ALTER TABLE messages RENAME COLUMN sender_session_id TO sender_user_id;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_role_check;
ALTER TABLE messages ADD CONSTRAINT messages_sender_role_check CHECK (sender_role IN ('admin', 'speaker', 'listener'));

CREATE TABLE IF NOT EXISTS room_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO room_config (id, admin_id) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING;
*/
