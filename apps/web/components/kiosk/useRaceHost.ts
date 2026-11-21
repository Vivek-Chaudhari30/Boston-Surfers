'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import {
  RACE,
  RACE_EVENTS,
  RacePosMsg,
  RacePresence,
  RaceResultsResponse,
  liveOrder,
  newRaceId,
  newRaceSeed,
  raceChannel,
  shouldEndRace,
  type LiveRacer,
  type RaceStanding,
  type RaceStateMsg,
} from '@/lib/race';
import { browserRealtime } from '@/lib/realtime';

export type RacePhase = 'idle' | 'countdown' | 'running' | 'results';

export type RaceView = {
  phase: RacePhase;
  msLeft: number;
  msElapsed: number;
  live: LiveRacer[];
  standings: RaceStanding[];
  /** false when the podium is the live order (API failed). */
  official: boolean;
  readyCount: number;
  readyNames: string[];
};

const IDLE_VIEW: RaceView = { phase: 'idle', msLeft: 0, msElapsed: 0, live: [], standings: [], official: true, readyCount: 0, readyNames: [] };

/** Phones submit /finish right after crashing; give them this long before asking the API. */
const SETTLE_MS = 2_000;
const FETCH_TIMEOUT_MS = 8_000;

type Machine = {
  phase: RacePhase;
  raceId: string;
  seed: number;
  countdownEnd: number;
  startedAt: number;
  endingAt: number | null;
  participants: string[];
  racers: Map<string, LiveRacer>;
  ready: Map<string, string>;
  standings: RaceStanding[];
  official: boolean;
  resultsAt: number;
  fetching: boolean;
};

/**
 * Kiosk side of Car Race. The kiosk hosts: it never tracks presence itself, ticks a state machine
 * once a second and broadcasts the phase. Broadcasts are hints; the podium comes from the API.
 * Without Supabase Realtime env vars the feature is off (view stays idle).
 */
export function useRaceHost(carId: string, kioskKey: string | null, onRaceEnd?: () => void): RaceView {
  const [view, setView] = useState<RaceView>(IDLE_VIEW);
  const onEnd = useRef(onRaceEnd);
  useEffect(() => {
    onEnd.current = onRaceEnd;
  }, [onRaceEnd]);

  useEffect(() => {
    const client = browserRealtime();
    if (!client || !kioskKey) return;

    const m: Machine = {
      phase: 'idle',
      raceId: '',
      seed: 0,
      countdownEnd: 0,
      startedAt: 0,
      endingAt: null,
      participants: [],
      racers: new Map(),
      ready: new Map(),
      standings: [],
      official: true,
      resultsAt: 0,
      fetching: false,
    };
    let subscribed = false;
    let disposed = false;
    let pubTimer: ReturnType<typeof setTimeout> | undefined;
    let inflight: AbortController | null = null;

    const ch = client.channel(raceChannel(carId), {
      config: { presence: { key: `kiosk-${carId}` }, broadcast: { self: false } },
    });

    const send = (payload: RaceStateMsg) => {
      if (!subscribed) return;
      void ch.send({ type: 'broadcast', event: RACE_EVENTS.state, payload }).catch(() => undefined);
    };

    const publish = () => {
      if (disposed) return;
      const now = Date.now();
      setView({
        phase: m.phase,
        msLeft: m.phase === 'countdown' ? Math.max(0, m.countdownEnd - now) : 0,
        msElapsed: m.phase === 'running' ? Math.max(0, now - m.startedAt) : 0,
        live: m.phase === 'running' || m.phase === 'results' ? liveOrder(m.racers.values()) : [],
        standings: m.standings,
        official: m.official,
        readyCount: m.ready.size,
        readyNames: [...m.ready.values()],
      });
    };

    const toIdle = () => {
      m.phase = 'idle';
      m.racers = new Map();
      m.participants = [];
      m.standings = [];
      m.official = true;
      m.endingAt = null;
      m.fetching = false;
      send({ phase: 'idle' });
    };

    const finish = async () => {
      m.fetching = true;
      const raceId = m.raceId;
      const fallback = (): RaceStanding[] =>
        liveOrder(m.racers.values()).map((r) => ({ riderId: r.riderId, displayName: r.name, score: r.score }));
      let standings: RaceStanding[];
      let official = true;
      const ac = new AbortController();
      inflight = ac;
      const timeout = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
      try {
        const q = new URLSearchParams({
          since: new Date(m.startedAt).toISOString(),
          riders: m.participants.join(','),
        });
        const res = await api(`/api/cars/${carId}/race?${q}`, RaceResultsResponse, { kioskKey, signal: ac.signal });
        standings = res.standings;
      } catch {
        standings = fallback();
        official = false;
      } finally {
        clearTimeout(timeout);
      }
      // A newer race (or unmount) may have superseded this one while fetching.
      if (disposed || m.raceId !== raceId || m.phase !== 'running') return;
      m.standings = standings;
      m.official = official;
      m.phase = 'results';
      m.resultsAt = Date.now();
      m.fetching = false;
      send({ phase: 'results', raceId, standings });
      publish();
      onEnd.current?.();
    };

    const tick = () => {
      const now = Date.now();
      switch (m.phase) {
        case 'idle': {
          if (m.ready.size >= 1) {
            m.raceId = newRaceId();
            m.seed = newRaceSeed();
            m.countdownEnd = now + RACE.COUNTDOWN_MS;
            m.phase = 'countdown';
            send({ phase: 'countdown', raceId: m.raceId, seed: m.seed, msLeft: RACE.COUNTDOWN_MS });
          }
          break;
        }
        case 'countdown': {
          if (m.ready.size === 0) {
            toIdle(); // everyone left before GO
            break;
          }
          if (now >= m.countdownEnd) {
            m.phase = 'running';
            m.startedAt = now;
            m.participants = [...m.ready.keys()];
            m.racers = new Map();
            m.endingAt = null;
            send({ phase: 'running', raceId: m.raceId, seed: m.seed, msElapsed: 0 });
          } else {
            send({ phase: 'countdown', raceId: m.raceId, seed: m.seed, msLeft: Math.min(60_000, m.countdownEnd - now) });
          }
          break;
        }
        case 'running': {
          send({ phase: 'running', raceId: m.raceId, seed: m.seed, msElapsed: Math.max(0, now - m.startedAt) });
          if (m.endingAt === null && shouldEndRace({ participants: m.participants, racers: m.racers, startedAt: m.startedAt, now })) {
            m.endingAt = now;
          }
          if (m.endingAt !== null && now - m.endingAt >= SETTLE_MS && !m.fetching) void finish();
          break;
        }
        case 'results': {
          if (now - m.resultsAt >= RACE.RESULTS_MS) toIdle();
          else send({ phase: 'results', raceId: m.raceId, standings: m.standings });
          break;
        }
      }
      publish();
    };

    ch.on('presence', { event: 'sync' }, () => {
      const next = new Map<string, string>();
      for (const metas of Object.values(ch.presenceState())) {
        for (const meta of metas) {
          const p = RacePresence.safeParse(meta);
          if (p.success) next.set(p.data.riderId, p.data.name);
        }
      }
      m.ready = next;
      publish();
    });

    ch.on('broadcast', { event: RACE_EVENTS.pos }, ({ payload }) => {
      if (m.phase !== 'running') return;
      const p = RacePosMsg.safeParse(payload);
      if (!p.success || p.data.raceId !== m.raceId || !m.participants.includes(p.data.riderId)) return;
      const prev = m.racers.get(p.data.riderId);
      // Once crashed, stay crashed; scores never go down.
      m.racers.set(p.data.riderId, {
        riderId: p.data.riderId,
        name: p.data.name,
        score: Math.max(prev?.score ?? 0, p.data.score),
        alive: (prev?.alive ?? true) && p.data.alive,
        seenAt: Date.now(),
      });
      if (!pubTimer) {
        pubTimer = setTimeout(() => {
          pubTimer = undefined;
          publish();
        }, 300);
      }
    });

    ch.subscribe((status) => {
      subscribed = status === 'SUBSCRIBED';
    });
    const interval = setInterval(tick, 1000);

    return () => {
      disposed = true;
      inflight?.abort();
      clearInterval(interval);
      clearTimeout(pubTimer);
      if (subscribed) void ch.send({ type: 'broadcast', event: RACE_EVENTS.state, payload: { phase: 'idle' } satisfies RaceStateMsg }).catch(() => undefined);
      void client.removeChannel(ch);
    };
  }, [carId, kioskKey]);

  return view;
}
