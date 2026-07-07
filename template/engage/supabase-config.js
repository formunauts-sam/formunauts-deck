/* ============================================================
   engage/supabase-config.js — PUBLIC Supabase project config.
   ------------------------------------------------------------
   These two values are PUBLIC by design and safe to embed in a
   client bundle. No service-role key ever ships to the browser.

   SECURITY POSTURE (Step 1, pre-auth). Database tables are guarded
   by RLS (on for every table). The live Engage layer runs over
   Realtime BROADCAST on a per-room channel; in this phase the
   protection is the UNGUESSABLE room code (join by secret link,
   like a meeting code) plus an optional room password. That keeps
   a random person out, but it is NOT per-user auth: anyone with the
   code can join. Step 2 (Google login, per-user identity) adds
   private channels + per-user authorization, which is where real
   presenter-vs-viewer enforcement belongs. Do not put sensitive
   content in a room whose code has been shared widely until Step 2.
   ============================================================ */

export const SUPABASE_URL = "https://iffrbytwrclvlvwgipeg.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZnJieXR3cmNsdmx2d2dpcGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTc0MDYsImV4cCI6MjA5ODk5MzQwNn0.PQx9lVMlfo5Y6X_RD1iABMRB7Or8nQwmiWlbjJanFYw";
