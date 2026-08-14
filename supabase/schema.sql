-- =========================================================
-- NFL Quiniela - esquema de base de datos para Supabase
-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase
-- =========================================================

-- Perfiles de usuario (uno por cada usuario de auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

-- Grupos / quinielas
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

-- Miembros de cada grupo
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- Partidos de cada grupo (el admin del grupo los captura por semana)
create table public.games (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  week int not null,
  home_team text not null,
  away_team text not null,
  kickoff timestamptz not null,
  home_score int,
  away_score int,
  status text not null default 'scheduled' check (status in ('scheduled', 'final')),
  created_at timestamptz default now()
);

-- Predicciones de cada usuario por partido
create table public.picks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pred_home_score int not null,
  pred_away_score int not null,
  points int,
  updated_at timestamptz default now(),
  unique (game_id, user_id)
);

-- =========================================================
-- Row Level Security
-- =========================================================
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.games enable row level security;
alter table public.picks enable row level security;

-- profiles: cualquier usuario autenticado puede leer nombres (para el leaderboard); cada quien edita el suyo
create policy "profiles: lectura publica" on public.profiles for select using (true);
create policy "profiles: insertar el propio" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: actualizar el propio" on public.profiles for update using (auth.uid() = id);

-- groups: solo miembros ven el grupo; cualquiera autenticado puede crear uno
create policy "groups: ver si soy miembro" on public.groups for select using (
  exists (select 1 from public.group_members gm where gm.group_id = id and gm.user_id = auth.uid())
);
create policy "groups: crear" on public.groups for insert with check (auth.uid() = created_by);

-- group_members: ver miembros de mis grupos; unirme yo mismo
create policy "members: ver de mis grupos" on public.group_members for select using (
  exists (select 1 from public.group_members gm2 where gm2.group_id = group_id and gm2.user_id = auth.uid())
);
create policy "members: unirme" on public.group_members for insert with check (auth.uid() = user_id);

-- games: solo miembros del grupo ven/gestionan partidos; el creador del grupo administra
create policy "games: ver de mis grupos" on public.games for select using (
  exists (select 1 from public.group_members gm where gm.group_id = games.group_id and gm.user_id = auth.uid())
);
create policy "games: admin crea" on public.games for insert with check (
  exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
);
create policy "games: admin actualiza" on public.games for update using (
  exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
);

-- picks: cada quien ve/crea/edita sus propias predicciones; puede ver las de otros solo si el partido ya inicio (para evitar copiar)
create policy "picks: ver propias siempre" on public.picks for select using (auth.uid() = user_id);
create policy "picks: ver ajenas tras kickoff" on public.picks for select using (
  exists (
    select 1 from public.games gm
    join public.group_members mem on mem.group_id = gm.group_id
    where gm.id = picks.game_id and mem.user_id = auth.uid() and gm.kickoff <= now()
  )
);
create policy "picks: crear propias" on public.picks for insert with check (auth.uid() = user_id);
create policy "picks: editar propias antes de kickoff" on public.picks for update using (
  auth.uid() = user_id and exists (
    select 1 from public.games gm where gm.id = game_id and gm.kickoff > now()
  )
);

-- =========================================================
-- Funcion para calcular puntos automaticamente al capturar marcador final
-- =========================================================
create or replace function public.calculate_points_for_game(p_game_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  g record;
begin
  select * into g from public.games where id = p_game_id;
  if g.status <> 'final' or g.home_score is null or g.away_score is null then
    return;
  end if;

  update public.picks
  set points = case
    when (sign(pred_home_score - pred_away_score) = sign(g.home_score - g.away_score))
      and pred_home_score = g.home_score and pred_away_score = g.away_score then 3
    when sign(pred_home_score - pred_away_score) = sign(g.home_score - g.away_score) then 1
    else 0
  end
  where game_id = p_game_id;
end;
$$;
