'use client';

import {
  CreateRideResponse,
  CreateRiderResponse,
  EndRideResponse,
  LINE_COLORS,
  MeResponse,
  type Ride,
  type RiderPublic,
} from '@cb/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, errorText, toE164 } from '@/lib/api-client';
import { Board } from './Board';
import { ClaimView } from './ClaimView';
import { claimStore, lastRunStore, type StoredClaim } from './storage';
import { Brand, Card, ErrorNote, GhostButton, PrimaryButton, Screen } from './ui';

type EndResult = Exclude<EndRideResponse, { result: 'won' }>;

export function carLabel(carId: string) {
  const [line = '', num = ''] = carId.split('-');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)} · Car ${num}`;
}

/** /play: QR landing → sign up → join car → lobby → get off → claim. */
export function PlayApp() {
  const router = useRouter();
  const params = useSearchParams();
  const car = params.get('car');
  const token = params.get('t');

  const [loading, setLoading] = useState(true);
  const [rider, setRider] = useState<RiderPublic | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [claim, setClaim] = useState<StoredClaim | null>(null);
  const [endResult, setEndResult] = useState<EndResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = useCallback(
    async (carId: string, joinToken: string) => {
      setBusy(true);
      setError(null);
      try {
        const r = await api('/api/rides', CreateRideResponse, { body: { carId, joinToken } });
        setRide(r.ride);
        setEndResult(null);
        router.replace('/play');
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api('/api/me', MeResponse);
        if (cancelled) return;
        setRider(me.rider);
        setRide(me.activeRide);
        setClaim(claimStore.get());
        if (me.rider && car && token && me.activeRide?.carId !== car) await join(car, token);
        else if (car && token && me.activeRide?.carId === car) router.replace('/play');
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on load
  }, []);

  async function signUp(displayName: string, phone: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await api('/api/riders', CreateRiderResponse, { body: { displayName, phone: toE164(phone) } });
      setRider(r.rider);
      if (car && token) await join(car, token);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function getOff() {
    if (!ride) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api(`/api/rides/${ride.id}/end`, EndRideResponse, { method: 'POST' });
      lastRunStore.set(null);
      setRide(null);
      if (r.result === 'won') {
        claimStore.set(r.claim);
        setClaim(r.claim);
      } else setEndResult(r);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <Brand />
        <p className="text-hud-dim">Loading…</p>
      </Screen>
    );
  }

  return (
    <Screen>
      <Brand sub={ride ? carLabel(ride.carId) : car ? `Joining ${carLabel(car)}` : undefined} />
      {error && <ErrorNote>{error}</ErrorNote>}

      {claim ? (
        <ClaimView
          claim={claim}
          onDone={() => {
            claimStore.set(null);
            setClaim(null);
          }}
        />
      ) : !rider ? (
        <SignUp busy={busy} onSubmit={signUp} />
      ) : ride ? (
        <Lobby rider={rider} ride={ride} busy={busy} onGetOff={getOff} />
      ) : endResult ? (
        <EndResultCard result={endResult} onDone={() => setEndResult(null)} />
      ) : busy ? (
        <p className="text-hud-dim">Joining…</p>
      ) : (
        <Card title={`Hi ${rider.displayName}`}>
          <p className="text-lg">Scan the QR code on the kiosk in your train car to join and play.</p>
          <p className="mt-3 text-sm text-hud-dim">The code changes every 30 seconds, so scan it live.</p>
          <Link href="/leaderboard" className="mt-4 inline-block text-mbta-green underline">
            Today&apos;s leaderboard →
          </Link>
        </Card>
      )}
    </Screen>
  );
}

function SignUp({ busy, onSubmit }: { busy: boolean; onSubmit: (name: string, phone: string) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const valid = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 10;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(name.trim(), phone);
      }}
    >
      <Card title="Join the game">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-hud-dim">Display name (shown on the boards)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            maxLength={16}
            autoComplete="nickname"
            placeholder="e.g. Spidey"
            className="rounded-lg border border-hud-border bg-hud-bg px-4 py-3 text-lg outline-none focus:border-mbta-green"
          />
        </label>
        <label className="mt-4 flex flex-col gap-2">
          <span className="text-sm text-hud-dim">Phone (never shown; it&apos;s how we know you next time)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="617 555 0123"
            className="rounded-lg border border-hud-border bg-hud-bg px-4 py-3 text-lg outline-none focus:border-mbta-green"
          />
        </label>
      </Card>
      <PrimaryButton type="submit" disabled={!valid || busy}>
        {busy ? 'Joining…' : 'Let’s ride'}
      </PrimaryButton>
    </form>
  );
}

function Lobby({ rider, ride, busy, onGetOff }: { rider: RiderPublic; ride: Ride; busy: boolean; onGetOff: () => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);
  const [last] = useState(() => {
    const l = lastRunStore.get();
    return l?.rideId === ride.id ? l : null;
  });
  return (
    <>
      <Card title={`${rider.displayName} · this ride`}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-hud-dim">Best score</p>
            <p className="font-mono text-4xl tabular-nums">{(last?.bestThisRide ?? 0).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-hud-dim">Car rank</p>
            <p className="font-mono text-4xl">{last?.carRank ? `#${last.carRank}` : '-'}</p>
          </div>
        </div>
      </Card>
      {last && (
        <Card title="Car leaderboard">
          <Board entries={last.carLeaderboard} highlightRank={last.carRank} />
        </Card>
      )}
      <PrimaryButton color={LINE_COLORS[ride.line]} disabled={busy} onClick={() => router.push('/play/run')}>
        ▶ Play
      </PrimaryButton>
      <GhostButton
        onClick={() => (confirming ? onGetOff() : setConfirming(true))}
        disabled={busy}
        className={confirming ? 'border-mbta-orange text-mbta-orange' : ''}
      >
        {confirming ? 'Tap again to end your ride' : 'I’m getting off'}
      </GhostButton>
      <p className="text-center text-sm text-hud-dim">Top of the car board when you get off wins a sticker.</p>
    </>
  );
}

function EndResultCard({ result, onDone }: { result: EndResult; onDone: () => void }) {
  const text =
    result.result === 'not_leader'
      ? `You finished #${result.rank}. ${result.leader.displayName} leads this car with ${result.leader.score.toLocaleString()}.`
      : result.result === 'no_score'
        ? 'Ride ended. You didn’t post a score this time.'
        : 'Ride ended. You already won a sticker today. One per rider per day!';
  return (
    <Card title="Thanks for riding">
      <p className="text-lg">{text}</p>
      <GhostButton className="mt-5" onClick={onDone}>
        OK
      </GhostButton>
    </Card>
  );
}
