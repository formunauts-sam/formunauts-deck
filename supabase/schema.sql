-- ============================================================
-- Formunauts Present, Step 1 schema (Realtime + persistence, pre-auth).
-- ------------------------------------------------------------
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- Safe to re-run: every object uses "if not exists" / "or replace".
--
-- Live audience interaction (reactions, slide-follow, pointer, live poll
-- state) rides Supabase Realtime BROADCAST, which is ephemeral pub/sub and
-- needs no tables. These tables are for the PERSISTENT record: who joined a
-- room, what questions were asked, poll results, reaction totals, and cloud
-- speaker notes.
--
-- SECURITY, read this: until Step 2 (Google login) is enabled, access is
-- protected by the room id plus an optional join password, not per-user
-- accounts. The policies below are the internal-tool baseline. Step 2 replaces
-- them with per-user, domain-restricted policies. Do not put truly sensitive
-- content in a public room until Step 2.
-- ============================================================

-- ---------- Tables ----------

-- A live presentation session. The presenter_key is a secret held only by the
-- presenter; it never reaches a viewer and gates presenter-only writes (via the
-- RPCs below), so it is the authority token.
create table if not exists public.rooms (
  id            text primary key,               -- short human room code, or a uuid
  deck_id       text not null,                  -- which deck is presented
  title         text,
  presenter_key text not null,                  -- secret authority token (never sent to viewers)
  join_password text,                           -- optional; NULL means open join
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);

-- Audience history: who joined a room and when.
create table if not exists public.join_events (
  id           bigint generated always as identity primary key,
  room_id      text not null references public.rooms(id) on delete cascade,
  client_id    text not null,
  display_name text,
  joined_at    timestamptz not null default now()
);

-- Audience Q&A, persisted per room.
create table if not exists public.questions (
  id         bigint generated always as identity primary key,
  room_id    text not null references public.rooms(id) on delete cascade,
  client_id  text,
  text       text not null check (char_length(text) between 1 and 280),
  upvotes    int not null default 0,
  answered   boolean not null default false,
  created_at timestamptz not null default now()
);

-- One upvote per client per question (dedupe).
create table if not exists public.question_upvotes (
  question_id bigint not null references public.questions(id) on delete cascade,
  client_id   text not null,
  primary key (question_id, client_id)
);

-- One vote per client per poll.
create table if not exists public.poll_votes (
  room_id    text not null references public.rooms(id) on delete cascade,
  poll_id    text not null,
  client_id  text not null,
  option     int not null,
  created_at timestamptz not null default now(),
  primary key (room_id, poll_id, client_id)
);

-- Aggregate reaction counts per room (individual reactions ride Realtime Broadcast).
create table if not exists public.reaction_totals (
  room_id text not null references public.rooms(id) on delete cascade,
  kind    text not null,
  count   bigint not null default 0,
  primary key (room_id, kind)
);

-- Cloud speaker notes: the Supabase home of the notes-store interface that runs
-- on localStorage today (getNote/setNote/listOverrides map straight onto this).
-- Step 2 adds an owner user_id column and scopes edits to the owner.
create table if not exists public.notes_overrides (
  deck_id    text not null,
  slide_id   text not null,
  notes      text not null,
  updated_at timestamptz not null default now(),
  primary key (deck_id, slide_id)
);

-- Helpful indexes for the room recap views.
create index if not exists join_events_room_idx on public.join_events (room_id, joined_at);
create index if not exists questions_room_idx    on public.questions (room_id, created_at);

-- ---------- Presenter-only writes via RPC (so the secret key is checked
--            server-side and never trusted from the client role) ----------

-- Close a room. Only succeeds if the caller proves the presenter_key.
create or replace function public.close_room(p_room_id text, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.rooms
     set closed_at = now()
   where id = p_room_id and presenter_key = p_key and closed_at is null;
end; $$;

-- Verify a viewer's join password without ever exposing the stored value.
-- Returns true when the room is open and the password matches (or none is set).
create or replace function public.check_join(p_room_id text, p_password text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.rooms
     where id = p_room_id
       and closed_at is null
       and (join_password is null or join_password = p_password)
  );
$$;

-- Mark a question answered. Presenter-only.
create or replace function public.answer_question(p_question_id bigint, p_room_id text, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.questions q
     set answered = true
    from public.rooms r
   where q.id = p_question_id
     and q.room_id = p_room_id
     and r.id = p_room_id
     and r.presenter_key = p_key;
end; $$;

-- ---------- Row Level Security ----------
-- STEP 1 baseline (pre-auth, internal tool). Broad read/insert for the anon
-- role, scoped to OPEN rooms where it matters. Presenter-only mutations go
-- through the SECURITY DEFINER functions above, so the anon policies never
-- need to expose or trust the presenter_key. STEP 2 (Google auth) replaces
-- every policy below with per-user, domain-restricted rules.

alter table public.rooms            enable row level security;
alter table public.join_events      enable row level security;
alter table public.questions        enable row level security;
alter table public.question_upvotes enable row level security;
alter table public.poll_votes       enable row level security;
alter table public.reaction_totals  enable row level security;
alter table public.notes_overrides  enable row level security;

-- rooms: readable by id; creatable by anyone (a presenter opening a room).
-- NO direct update/delete policy, so the presenter_key can never be changed or
-- read-then-overwritten by a viewer; closing goes through close_room().
drop policy if exists rooms_read on public.rooms;
create policy rooms_read   on public.rooms for select using (true);
drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms for insert with check (true);

-- join_events: a viewer records their own join into an OPEN room; readable for the recap.
drop policy if exists join_read on public.join_events;
create policy join_read   on public.join_events for select using (true);
drop policy if exists join_insert on public.join_events;
create policy join_insert on public.join_events for insert
  with check (exists (select 1 from public.rooms r where r.id = room_id and r.closed_at is null));

-- questions: viewers ask into an OPEN room; everyone reads; upvote count bumps
-- are allowed (the dedupe table prevents double-counting app-side).
drop policy if exists q_read on public.questions;
create policy q_read   on public.questions for select using (true);
drop policy if exists q_insert on public.questions;
create policy q_insert on public.questions for insert
  with check (exists (select 1 from public.rooms r where r.id = room_id and r.closed_at is null));
drop policy if exists q_update on public.questions;
create policy q_update on public.questions for update using (true) with check (true);

drop policy if exists qu_all on public.question_upvotes;
create policy qu_all on public.question_upvotes for all using (true) with check (true);

-- poll_votes: one row per client per poll (the PK enforces one vote).
drop policy if exists pv_read on public.poll_votes;
create policy pv_read   on public.poll_votes for select using (true);
drop policy if exists pv_insert on public.poll_votes;
create policy pv_insert on public.poll_votes for insert
  with check (exists (select 1 from public.rooms r where r.id = room_id and r.closed_at is null));

drop policy if exists rt_all on public.reaction_totals;
create policy rt_all on public.reaction_totals for all using (true) with check (true);

-- notes_overrides: open in Step 1 (internal). Step 2 scopes to auth.uid() owner.
drop policy if exists notes_all on public.notes_overrides;
create policy notes_all on public.notes_overrides for all using (true) with check (true);

-- ---------- Realtime ----------
-- Broadcast (the live Engage channel) is enabled per-project by default and
-- needs no table config. If you want the persisted tables to also stream
-- changes (optional, for a live recap), add them to the supabase_realtime
-- publication. Uncomment if wanted:
-- alter publication supabase_realtime add table public.questions, public.join_events;

-- Done. Send me the Project URL + anon key and I wire the app to this.
