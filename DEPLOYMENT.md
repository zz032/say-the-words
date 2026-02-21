# Deploy to Vercel — Step-by-Step Guide

Follow these steps to deploy your project to a public URL.

---

## Prerequisites

- A [Vercel account](https://vercel.com/signup) (free)
- A [Supabase project](https://supabase.com) with the schema applied
- Your Supabase **URL** and **anon key** (Supabase Dashboard → Project Settings → API)

---

## Step 1: Push to Git (if not already)

Vercel deploys from Git. If your project isn’t in a repo yet:

1. Create a new repo on [GitHub](https://github.com/new)
2. In your project folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

---

## Step 2: Import Project to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New…** → **Project**
3. Import your Git repository (GitHub/GitLab/Bitbucket)
4. Select the **say the words** (or your repo name) project
5. Click **Import**

---

## Step 3: Configure Environment Variables

Before deploying, add your Supabase credentials:

1. On the **Configure Project** screen, expand **Environment Variables**
2. Add these two variables:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` (your Supabase project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` (your Supabase anon/public key) |

3. Leave **Environment** as **Production** (and optionally add the same for Preview if you use branches)
4. Click **Deploy**

---

## Step 4: Wait for Build

Vercel will build and deploy. This usually takes 1–2 minutes.

---

## After Deployment

### URLs

| Purpose | URL |
|---------|-----|
| **Main app** (share with testers) | `https://YOUR_PROJECT.vercel.app` |
| **Admin dashboard** | `https://YOUR_PROJECT.vercel.app/admin` |

### Environment Variables (for reference)

These must be set in Vercel (Project Settings → Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key

### Supabase configuration

1. In Supabase Dashboard → **Authentication** → **URL Configuration**, add your Vercel URL to **Site URL** and **Redirect URLs** if you add auth later (optional for this MVP).
2. In **Database** → **Replication**, ensure `participants`, `messages`, and `room_config` have Realtime enabled.

---

## Troubleshooting

- **"Setup required"** on the app → Env vars are missing or wrong. Re-check them in Vercel.
- **Realtime not updating** → Enable Realtime for the tables in Supabase.
- **Build fails** → Check the build logs in Vercel. Ensure `npm run build` works locally.
