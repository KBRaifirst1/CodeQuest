-- ============================================================
-- CodeQuest — Supabase schema
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- It creates one table that stores each user's entire saved state, protected
-- so users can only ever read/write their OWN row.
-- ============================================================

-- One row per user holds their whole app state as JSON.
-- (Simple and robust for an app like this — no joins, easy to load/save.)
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  progress   jsonb not null default '{}'::jsonb,   -- { classId: [doneStepIdx, ...] }
  ai_lessons jsonb not null default '{}'::jsonb,   -- { classId: [generatedStep, ...] }
  projects   jsonb not null default '[]'::jsonb,   -- [ finishedProjectPlan, ... ]
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_user_state on public.user_state;
create trigger trg_touch_user_state
  before update on public.user_state
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Row Level Security: each user can only touch their own row.
-- This is what makes it safe to ship publicly.
-- ============================================================
alter table public.user_state enable row level security;

drop policy if exists "read own state"   on public.user_state;
drop policy if exists "insert own state" on public.user_state;
drop policy if exists "update own state" on public.user_state;

create policy "read own state"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "insert own state"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "update own state"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
