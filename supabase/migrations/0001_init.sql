create extension if not exists pgcrypto;

create table riders (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,                        -- E.164, never shown publicly
  display_name text not null check (char_length(display_name) between 2 and 16),
  created_at timestamptz not null default now()
);

create table cars (
  id text primary key,                               -- 'green-3812'
  line text not null,                                -- 'Red' | 'Orange' | 'Blue' | 'Green'
  car_number text not null,                          -- '3812'
  vehicle_id text,                                   -- pinned MBTA vehicle id (demo)
  created_at timestamptz not null default now()
);

create table rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references riders(id),
  car_id text not null references cars(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz                               -- null = active
);
create index rides_active_by_car on rides(car_id) where ended_at is null;

create table runs (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id),
  rider_id uuid not null references riders(id),
  car_id text not null references cars(id),
  seed int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score int, coins int, duration_ms int,
  status text not null default 'started' check (status in ('started','finished','rejected')),
  reject_reason text
);
create index runs_finished_by_car on runs(car_id) where status = 'finished';

create table claims (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                         -- 6 chars, no 0/O/1/I
  ride_id uuid not null references rides(id),
  rider_id uuid not null references riders(id),
  car_id text not null references cars(id),
  score int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  dispense_status text                               -- 'done' | 'error' | null
);

-- Car board: best finished run per rider, active rides only.
create view car_leaderboard as
select ru.car_id, ru.rider_id, ri.display_name,
       max(ru.score) as best_score, min(ru.finished_at) as first_at
from runs ru
join rides rd on rd.id = ru.ride_id and rd.ended_at is null
             and rd.started_at > now() - interval '90 minutes'
join riders ri on ri.id = ru.rider_id
where ru.status = 'finished'
group by ru.car_id, ru.rider_id, ri.display_name;

-- Daily board (Boston time): best finished run per rider per day.
create view daily_leaderboard as
select (ru.finished_at at time zone 'America/New_York')::date as day,
       ru.rider_id, ri.display_name,
       max(ru.score) as best_score,
       (array_agg(c.line order by ru.score desc))[1] as line
from runs ru
join riders ri on ri.id = ru.rider_id
join cars c on c.id = ru.car_id
where ru.status = 'finished'
group by 1, 2, 3;

alter table riders enable row level security;
alter table cars enable row level security;
alter table rides enable row level security;
alter table runs enable row level security;
alter table claims enable row level security;
-- No policies: only the server (service key) touches tables.

insert into cars (id, line, car_number) values ('green-3812', 'Green', '3812');
