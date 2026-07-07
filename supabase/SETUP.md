# Formunauts Present, Supabase setup

This is the backend that turns the tool into a real company tool: real audience
phones, activity and question history, protected join links, and cloud notes.
You do a few clicks. I do the rest. No coding on your side.

Two steps. Step 1 is easy and unlocks most of the value. Step 2 (Google login +
calendar) is a bit more involved, so do it only when you want those.

---

## Step 1, create the project (about 5 minutes)

1. Go to https://supabase.com and sign in (GitHub or email).
2. Click **New project**.
   - Name: `formunauts-present`
   - Database password: pick a strong one and save it in your password manager (you rarely need it).
   - Region: **Central EU (Frankfurt)** (closest to Austria, keeps latency low).
   - Plan: **Free** is plenty for our audience sizes.
3. Click **Create new project** and wait about two minutes while it provisions.
4. In the left sidebar open **Project Settings** (the gear), then **API**.
5. Copy these **two public values** and send them to me:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** key (a long token labelled `anon` / `public`)

Both are safe to share and are meant to live in the browser. Do NOT send the
`service_role` key or your database password, we never need those in the app.

### Then I will
- Give you ONE block of SQL to paste into the Supabase **SQL Editor** and run
  (from `supabase/schema.sql` in this repo). That creates the tables and the
  security rules. One copy, paste, Run.
- Wire the app to your project and flip Engage onto real phones with `?engage=supabase`.
- Verify it end to end and deploy.

**What Step 1 gives you**
- Engage on real cross-device phones (viewers on their own networks, not the same browser).
- Activity and question history per room, saved (who joined, what was asked).
- Password-protected join links, a room can require a code.
- Speaker notes synced to the cloud instead of only this browser.

---

## Step 2, Google login and calendar (do later, I will guide you live)

This adds per-user accounts restricted to Formunauts (and any domains you allow),
and the calendar drag-and-drop that ties a deck to a meeting. It needs a Google
OAuth client, which is set up in the Google Cloud Console. It is more clicks, so
we do it as its own guided session when you are ready. High level:

1. Google Cloud Console, create an OAuth consent screen (internal, Formunauts workspace).
2. Create an OAuth client (web), add Supabase's callback URL as an authorized redirect.
3. In Supabase, Authentication, Providers, enable Google, paste the client id/secret.
4. Restrict sign-in to your domain(s). I enforce the allow-list in the app + security rules.
5. For calendar, add the Calendar read scope and I wire the drag-and-drop.

I will hand you the exact values to paste at each step when we get here.

---

## Security note (honest)

Until Step 2 (Google login) is in, room access is protected by the room id plus
an optional room password, which is fine for internal use but is not full
account-level security. Step 2 adds real per-user auth and domain restriction.
The security rules in `schema.sql` are written to tighten automatically once
auth is on. Do not make any room truly public until Step 2 if the content is
sensitive.
