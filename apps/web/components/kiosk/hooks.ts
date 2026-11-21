'use client';

import {
  CarStateResponse,
  JoinTokenResponse,
  JOIN_TOKEN_WINDOW_MS,
  TransfersResponse,
  carChannel,
} from '@cb/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from '@/lib/api-client';
import { subscribeChanged } from '@/lib/realtime';

const KEY_STORAGE = 'cb:kiosk-key';

/** Kiosk key from ?key= (saved to localStorage so the URL can be shared without it later). */
export function useKioskKey(fromUrl: string | null): string | null {
  const [key, setKey] = useState<string | null>(fromUrl);
  useEffect(() => {
    try {
      if (fromUrl) localStorage.setItem(KEY_STORAGE, fromUrl);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      else setKey(localStorage.getItem(KEY_STORAGE));
    } catch {
      /* storage blocked: rely on the URL */
    }
  }, [fromUrl]);
  return key;
}

/**
 * Car state: polled every 15 s and refetched (debounced 300 ms) on any `car:<id>` broadcast.
 * Broadcast payloads are ignored: they are only hints (ARCHITECTURE §4).
 */
export function useCarState(carId: string, kioskKey: string | null) {
  const [state, setState] = useState<CarStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [realtimeHits, setRealtimeHits] = useState(0);

  const load = useCallback(async () => {
    if (!kioskKey) return;
    try {
      setState(await api(`/api/cars/${carId}/state`, CarStateResponse, { kioskKey }));
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, [carId, kioskKey]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const poll = setInterval(load, 15_000);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const off = subscribeChanged(carChannel(carId), () => {
      setRealtimeHits((n) => n + 1);
      clearTimeout(debounce);
      debounce = setTimeout(load, 300);
    });
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearTimeout(debounce);
      off();
    };
  }, [carId, load]);

  return { state, error, reload: load, realtimeHits };
}

/** Rotating join QR: refetch every 25 s (tokens live ≤ 60 s). */
export function useJoinToken(carId: string, kioskKey: string | null) {
  const [token, setToken] = useState<JoinTokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!kioskKey) return;
    let stop = false;
    const load = async () => {
      try {
        const t = await api(`/api/cars/${carId}/join-token`, JoinTokenResponse, { kioskKey });
        if (!stop) {
          setToken(t);
          setError(null);
        }
      } catch (err) {
        if (!stop) setError(errorText(err));
      }
    };
    void load();
    const t = setInterval(load, 25_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [carId, kioskKey]);
  return { token, error };
}

/** Seconds left in the current 30 s join window, ticking. */
export function useWindowCountdown() {
  const [left, setLeft] = useState(30);
  useEffect(() => {
    const tick = () => setLeft(Math.ceil((JOIN_TOKEN_WINDOW_MS - (Date.now() % JOIN_TOKEN_WINDOW_MS)) / 1000));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, []);
  return left;
}

/** Transfer help for the pinned vehicle, every 15 s. */
export function useTransfers(vehicleId: string | null) {
  const [data, setData] = useState<TransfersResponse | null>(null);
  useEffect(() => {
    if (!vehicleId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale data when unpinned
      setData(null);
      return;
    }
    let stop = false;
    const load = async () => {
      try {
        const r = await api(`/api/transfers?vehicleId=${encodeURIComponent(vehicleId)}`, TransfersResponse);
        if (!stop) setData(r);
      } catch {
        /* keep last */
      }
    };
    void load();
    const t = setInterval(load, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [vehicleId]);
  return data;
}

/** A transient message that clears itself. */
export function useToast(ms = 4000) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback(
    (m: string) => {
      setMsg(m);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), ms);
    },
    [ms],
  );
  return [msg, show] as const;
}
