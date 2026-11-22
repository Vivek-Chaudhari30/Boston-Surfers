-- Awards: every win a rider earns, by type. Additive only (no drops, no changes to existing tables).
-- Only the server (service key) touches these tables; RLS on, no policies.

create table if not exists award_types (
  id text primary key,                               -- 'car_champion' | 'race_podium' | 'daily_champion' | 'score_milestone'
  name text not null,
  description text not null,
  icon text not null,                                -- single emoji/glyph for the UI
  sort int not null default 0
);

create table if not exists awards (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references riders(id),
  type_id text not null references award_types(id),
  dedupe_key text not null unique,                   -- makes every grant idempotent
  title text not null,                               -- 'Car champion · green-3812', '2nd place race', …
  rank int,                                          -- podium / daily place
  score int,
  car_id text references cars(id),
  ride_id uuid references rides(id),
  run_id uuid references runs(id),
  claim_id uuid references claims(id),
  day date,                                          -- Boston date for daily awards
  meta jsonb not null default '{}'::jsonb,
  won_at timestamptz not null default now()
);

create index if not exists awards_rider_idx on awards (rider_id, won_at desc);
create index if not exists runs_rider_idx on runs (rider_id, finished_at desc);

alter table award_types enable row level security;
alter table awards enable row level security;
revoke all on award_types, awards from anon, authenticated;

insert into award_types (id, name, description, icon, sort) values
  ('car_champion',    'Car champion',    'Led your train car when you got off. The kiosk dispensed your voucher.', '🏆', 1),
  ('race_podium',     'Race podium',     'Finished 1st, 2nd or 3rd in a live car race.',                               '🥇', 2),
  ('daily_champion',  'Daily champion',  'Top score on the whole T for a day.',                                         '👑', 3),
  ('score_milestone', 'Score milestone', 'Hit a score that unlocks a local station reward (250 / 500 / 750).',         '⭐', 4)
on conflict (id) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort = excluded.sort;
