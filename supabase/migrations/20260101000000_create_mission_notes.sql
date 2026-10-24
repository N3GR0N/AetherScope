-- ==============================================================================
-- AetherScope: Migración de Base de Datos - Modelo Ternario para Bitácora Espacial
-- Base de Datos: PostgreSQL / Supabase
-- Entidades: auth.users (Usuarios) + coordinates (Coordenadas) + mission_notes (Notas)
-- AUDITORÍA DE SEGURIDAD APLICADA:
-- - Hardening de funciones security definer (previene search_path hijacking)
-- - Validación de longitud de strings (previene agotamiento de recursos / DoS)
-- - Aislamiento estricto de privilegios (Principio de Menor Privilegio)
-- ==============================================================================

-- 1. TABLA: coordinates (Entidad Coordenadas Celestes)
create table if not exists public.coordinates (
  id uuid primary key default gen_random_uuid(),
  ra_deg double precision not null check (ra_deg >= 0 and ra_deg < 360),
  dec_deg double precision not null check (dec_deg >= -90 and dec_deg <= 90),
  radius_deg double precision not null default 0.1 check (radius_deg > 0 and radius_deg <= 180),
  object_id text check (object_id is null or char_length(object_id) <= 255),
  object_name text check (object_name is null or char_length(object_name) <= 255),
  created_at timestamptz not null default now(),
  constraint uq_coordinates_position unique (ra_deg, dec_deg)
);

-- Índices para búsqueda de coordenadas
create index if not exists idx_coordinates_position on public.coordinates (ra_deg, dec_deg);
create index if not exists idx_coordinates_object_id on public.coordinates (object_id);

-- 2. TABLA: mission_notes (Relación Ternaria Reificada)
create table if not exists public.mission_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coordinate_id uuid not null references public.coordinates (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para optimización de queries por usuario y por coordenadas
create index if not exists idx_mission_notes_user_id on public.mission_notes (user_id);
create index if not exists idx_mission_notes_coordinate_id on public.mission_notes (coordinate_id);
create index if not exists idx_mission_notes_user_coordinate on public.mission_notes (user_id, coordinate_id);

-- 3. TRIGGER: Actualización automática de updated_at (Hardened)
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_mission_notes_updated_at on public.mission_notes;
create trigger set_mission_notes_updated_at
  before update on public.mission_notes
  for each row execute function public.handle_updated_at();

-- 4. FUNCIÓN RPC: Registro u obtención atómica de coordenadas celestes (Hardened)
create or replace function public.upsert_coordinate(
  p_ra_deg double precision,
  p_dec_deg double precision,
  p_radius_deg double precision default 0.1,
  p_object_id text default null,
  p_object_name text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_obj_id text;
  v_obj_name text;
begin
  -- Validación defensiva de parámetros
  if p_ra_deg < 0 or p_ra_deg >= 360 or p_dec_deg < -90 or p_dec_deg > 90 or p_radius_deg <= 0 or p_radius_deg > 180 then
    raise exception 'PARAMETROS_INVALIDOS: Coordenadas astronómicas fuera de rango matemático.';
  end if;

  v_obj_id := substring(p_object_id from 1 for 255);
  v_obj_name := substring(p_object_name from 1 for 255);

  select id into v_id
  from public.coordinates
  where ra_deg = p_ra_deg and dec_deg = p_dec_deg
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.coordinates (ra_deg, dec_deg, radius_deg, object_id, object_name)
  values (p_ra_deg, p_dec_deg, p_radius_deg, v_obj_id, v_obj_name)
  on conflict (ra_deg, dec_deg) do update
    set radius_deg = excluded.radius_deg,
        object_id = coalesce(excluded.object_id, public.coordinates.object_id),
        object_name = coalesce(excluded.object_name, public.coordinates.object_name)
  returning id into v_id;

  return v_id;
end;
$$;

-- Restricción de ejecución RPC (Principio de Menor Privilegio)
revoke all on function public.upsert_coordinate(double precision, double precision, double precision, text, text) from public;
grant execute on function public.upsert_coordinate(double precision, double precision, double precision, text, text) to authenticated;

-- 5. SEGURIDAD: Row Level Security (RLS)
alter table public.coordinates enable row level security;
alter table public.mission_notes enable row level security;

-- Permisos estrictos de acceso (Least Privilege)
revoke all on public.coordinates from public, anon;
revoke all on public.mission_notes from public, anon;

grant select on public.coordinates to authenticated, anon;
grant insert on public.coordinates to authenticated;
grant select, insert, update, delete on public.mission_notes to authenticated;

-- Políticas en coordinates:
create policy "Coordinates are readable by everyone"
  on public.coordinates for select
  to public
  using (true);

create policy "Authenticated users can create coordinates"
  on public.coordinates for insert
  to authenticated
  with check (true);

-- Políticas en mission_notes (Aislamiento estricto por usuario):
create policy "Users can read only their own notes"
  on public.mission_notes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert only their own notes"
  on public.mission_notes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update only their own notes"
  on public.mission_notes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete only their own notes"
  on public.mission_notes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 6. VISTA: Unión relacional protegida por RLS
create or replace view public.v_user_mission_notes
with (security_invoker = true) as
select
  n.id,
  n.user_id,
  n.coordinate_id,
  c.ra_deg,
  c.dec_deg,
  c.radius_deg,
  c.object_id,
  c.object_name,
  n.body,
  n.created_at,
  n.updated_at
from public.mission_notes n
inner join public.coordinates c on c.id = n.coordinate_id;
