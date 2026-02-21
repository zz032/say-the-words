# Say the Words

A minimal anonymous social interaction web app. One fixed room, one Speaker and up to 10 Listeners.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Database > Replication** and enable Realtime for `participants` and `messages` tables
4. Go to **Project Settings > API** and copy the URL and anon key

### 3. Environment

Copy `.env.local.example` to `.env.local` and add your credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

- **Identity**: Each visitor gets a persistent `userId` in localStorage (generated if missing)
- **First user** becomes Admin (stored in DB; Admin does NOT count toward 11)
- **First user** becomes a hidden/invisible Admin: their `userId` is stored in `room_config.admin_id` but they are NOT inserted into the `participants` table, so they do NOT count toward the 11-person capacity. The invisible Admin can see all messages (speaker + all listener replies).
	- Note: there is also a client-only observer mode `?admin=godmode` that shows the same admin view without being stored as the DB admin.
- **Second user** becomes Speaker
- **Next 9 users** become Listeners (max 11 = Speaker + Listeners)
- **12th participant** sees "Room is full"
- **Refresh/reopen**: Recognized by userId; role restored; no duplicates
- **Speaker leaves**: Must click "Leave"; refresh/close does NOT remove. Next Listener becomes Speaker
- Speaker/Admin: 3 messages/day (resets 6:00 AM Beijing time)
- Each Listener: one message ever (persisted in DB)
