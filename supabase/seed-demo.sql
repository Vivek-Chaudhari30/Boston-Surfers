-- Demo history for the pitch: 6 riders with fictional 555-01xx phones, plays over the last 6 days
-- (never today, so today's live board stays clean), a past car champion voucher and race podiums.
-- Idempotent: re-running does nothing once the demo riders exist.
do $$
declare
  names text[] := array['Mira','Theo','Zara','Kofi','Lena','Ravi'];
  r uuid; ride uuid; run uuid; claim uuid;
  d int; k int; s int; t timestamptz;
begin
  if exists (select 1 from riders where phone = '+16175550101') then return; end if;
  for i in 1..array_length(names,1) loop
    insert into riders (phone, display_name, created_at)
      values ('+161755501' || lpad(i::text, 2, '0'), names[i], now() - interval '7 days')
      returning id into r;
    for d in 1..6 loop
      continue when (i + d) % 3 = 0;               -- not everyone rides every day
      t := date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York'
           - make_interval(days => d) + make_interval(hours => 8 + i, mins => 7 * d);
      insert into rides (rider_id, car_id, started_at, ended_at)
        values (r, 'green-3812', t, t + interval '25 minutes') returning id into ride;
      for k in 1..(1 + (i + d) % 3) loop
        s := 180 + ((i * 97 + d * 53 + k * 31) % 700);
        insert into runs (ride_id, rider_id, car_id, seed, started_at, finished_at, score, coins, duration_ms, status)
          values (ride, r, 'green-3812', i * 1000 + d * 10 + k, t + make_interval(mins => 3 * k),
                  t + make_interval(mins => 3 * k, secs => 40 + s / 10), s, s / 25, (40 + s / 10) * 1000, 'finished')
          returning id into run;
        insert into awards (rider_id, type_id, dedupe_key, title, score, car_id, run_id, meta, won_at)
          select r, 'score_milestone', 'milestone:' || r || ':' || tier, tier || ' points unlocked', s, 'green-3812', run,
                 jsonb_build_object('tier', tier), t + make_interval(mins => 3 * k, secs => 40)
          from unnest(array[250,500,750]) tier where s >= tier
          on conflict (dedupe_key) do nothing;
      end loop;
      if i = 2 and d = 2 then                      -- Theo led the car and got off: voucher dispensed
        insert into claims (code, ride_id, rider_id, car_id, score, created_at, expires_at, redeemed_at, dispense_status)
          values ('DEMO2X', ride, r, 'green-3812', s, t + interval '25 minutes', t + interval '27 minutes', t + interval '25 minutes 30 seconds', 'done')
          returning id into claim;
        insert into awards (rider_id, type_id, dedupe_key, title, rank, score, car_id, ride_id, claim_id, won_at)
          values (r, 'car_champion', 'car:' || claim, 'Car champion · green-3812', 1, s, 'green-3812', ride, claim, t + interval '25 minutes');
      end if;
    end loop;
  end loop;
  -- Two past races in the car with a podium each.
  insert into awards (rider_id, type_id, dedupe_key, title, rank, score, car_id, meta, won_at)
  select ri.id, 'race_podium', 'race:demo:' || x.day || ':' || x.rank, x.ord || ' place · car race', x.rank, x.score, 'green-3812',
         jsonb_build_object('racers', 4), now() - make_interval(days => x.day)
  from (values (1, 1, 'Zara', '1st', 812), (1, 2, 'Mira', '2nd', 640), (1, 3, 'Kofi', '3rd', 515),
               (3, 1, 'Theo', '1st', 705), (3, 2, 'Lena', '2nd', 590), (3, 3, 'Ravi', '3rd', 402)) x(day, rank, name, ord, score)
  join riders ri on ri.display_name = x.name and ri.phone like '+161755501%';
end $$;
