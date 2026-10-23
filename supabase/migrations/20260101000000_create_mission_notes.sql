-- AetherScope: Migración de base de datos para Bitácora de Misión (Supabase / PostgreSQL)
-- NO APLICADA - Archivo preparado para activación futura de cuentas y persistencia remota.

create table public.mission_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  object_id text,
  object_name text,
  ra_deg double precision not null check (ra_deg >= 0 and ra_deg < 360),
  dec_deg double precision not null check (dec_deg between -90 and 90),
  radius_deg double precision not null check (radius_deg > 0),
  body text not null check (char_length(body) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mission_notes_user_id_idx on public.mission_notes (user_id);
create index mission_notes_object_id_idx on public.mission_notes (object_id);

alter table public.mission_notes enable row level security;

revoke all on public.mission_notes from anon;
revoke all on public.mission_notes from authenticated;
grant select, insert, update, delete on public.mission_notes to authenticated;

create policy "Users can read their own notes" on public.mission_notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own notes" on public.mission_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own notes" on public.mission_notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own notes" on public.mission_notes
  for delete to authenticated using ((select auth.uid()) = user_id);
