"use client";

import {
  FinishRunResponse,
  LINE_COLORS,
  MeResponse,
  StartRunResponse,
  type Ride,
  type RiderPublic,
} from "@cb/shared";
import type { RunResult } from "@cb/game";
import type { RealtimeChannel } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "@/lib/api-client";
import {
  RACE,
  RACE_EVENTS,
  RacePosMsg,
  RaceStateMsg,
  raceChannel,
  liveOrder,
  type LiveRacer,
  RacePresence,
  type RaceStanding,
} from "@/lib/race";
import { browserRealtime } from "@/lib/realtime";
import { mergeRacer, nextGoAt, shouldSendPos } from "@/components/play/raceLogic";
import { BigText, Countdown, LiveStandings, Podium } from "@/components/play/RaceViews";
import { RunResults } from "@/components/play/RunResults";
import { lastRunStore } from "@/components/play/storage";
import { ErrorNote } from "@/components/play/ui";
import { LeaveTrain } from "./LeaveTrain";

const GameCanvas = dynamic(() => import("@/components/play/GameCanvas"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-hud-dim">Loading game…</p>,
});

type Phase =
  | "loading"
  | "idle"
  | "countdown"
  | "starting"
  | "playing"
  | "done"
  | "spectate"
  | "results";
type RaceRun = { raceId: string; seed: number; runId: string };

const KIOSK_WAIT_MS = 5000;
const FINAL_POS_SENDS = 3;
const FINAL_POS_GAP_MS = 300;

/** /mobile/race: live multiplayer run against everyone in the car. The kiosk hosts; this page is "ready" by being open. */
export function MobileRace() {
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [rider, setRider] = useState<RiderPublic | null>(null);
  const [phase, setPhaseState] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [noKiosk, setNoKiosk] = useState(false);
  const [secs, setSecs] = useState(0);
  const [lobby, setLobby] = useState<RacePresence[]>([]);
  const present = lobby.length;
  const [racers, setRacers] = useState<ReadonlyMap<string, LiveRacer>>(
    () => new Map(),
  );
  const [now, setNow] = useState(0);
  const [run, setRun] = useState<RaceRun | null>(null);
  const [hint, setHint] = useState(false);
  const [standings, setStandings] = useState<RaceStanding[] | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [finishedRun, setFinishedRun] = useState<RunResult | null>(null);
  const [result, setResult] = useState<FinishRunResponse | null>(null);
  const realtimeOk =
    typeof window === "undefined" ? true : browserRealtime() !== null;

  const phaseRef = useRef<Phase>("loading");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const goAtRef = useRef<number | null>(null);
  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Race I'm tracking (countdown / playing / spectating). */
  const raceRef = useRef<string | null>(null);
  /** Race I already started a run for (never start twice). */
  const startedRef = useRef<string | null>(null);
  const runRef = useRef<RaceRun | null>(null);
  const submitted = useRef<string | null>(null);
  const lastPosAt = useRef(0);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  // Lock page scroll (iOS Safari swipes) and load rider + active ride.
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.overflow, html.style.overscrollBehavior];
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    (async () => {
      try {
        const me = await api("/api/me", MeResponse);
        if (!me.rider || !me.activeRide) return router.replace("/mobile");
        setRider(me.rider);
        setRide(me.activeRide);
        setPhase("idle");
      } catch (err) {
        setError(errorText(err));
      }
    })();
    return () => {
      [html.style.overflow, html.style.overscrollBehavior] = prev;
    };
  }, [router, setPhase]);

  const riderId = rider?.id ?? null;
  const riderName = rider?.displayName ?? null;
  const carId = ride?.carId ?? null;
  const rideId = ride?.id ?? null;

  // Channel: presence (ready) + state/pos broadcasts.
  useEffect(() => {
    const client = browserRealtime();
    if (!client || !riderId || !riderName || !carId || !rideId) return;
    let gotState = false;

    const resetRacers = () => setRacers(new Map());

    const startRace = async (raceId: string, seed: number) => {
      if (startedRef.current === raceId) return;
      startedRef.current = raceId;
      raceRef.current = raceId;
      setPhase("starting");
      try {
        // The server-issued seed from /api/runs is unused for race runs: every phone plays the kiosk's race seed.
        // Finish validation checks score/duration only, never the seed.
        const r = await api("/api/runs", StartRunResponse, {
          body: { rideId },
        });
        const next = { raceId, seed, runId: r.runId };
        runRef.current = next;
        setResult(null);
        setMyScore(0);
        setFinishedRun(null);
        lastPosAt.current = 0;
        setRun(next);
        setPhase("playing");
        setHint(true);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(false), 3000);
      } catch (err) {
        setError(errorText(err));
        setPhase("idle");
      }
    };

    const scheduleGo = (raceId: string, seed: number) => {
      if (goTimer.current) clearTimeout(goTimer.current);
      const wait = Math.max(0, (goAtRef.current ?? Date.now()) - Date.now());
      goTimer.current = setTimeout(() => {
        if (raceRef.current === raceId && phaseRef.current === "countdown")
          void startRace(raceId, seed);
      }, wait);
    };

    const onState = (payload: unknown) => {
      const parsed = RaceStateMsg.safeParse(payload);
      if (!parsed.success) return;
      gotState = true;
      setNoKiosk(false);
      const msg = parsed.data;
      const phaseNow = phaseRef.current;
      switch (msg.phase) {
        case "idle":
          // Keep the podium / my finished screen until the rider taps "Race again".
          if (phaseNow === "countdown" || phaseNow === "spectate") {
            raceRef.current = null;
            goAtRef.current = null;
            if (goTimer.current) clearTimeout(goTimer.current);
            setPhase("idle");
          }
          break;
        case "countdown": {
          if (
            startedRef.current === msg.raceId ||
            phaseNow === "playing" ||
            phaseNow === "starting" ||
            phaseNow === "done"
          )
            break;
          const isNew = raceRef.current !== msg.raceId;
          if (isNew) {
            goAtRef.current = null;
            raceRef.current = msg.raceId;
            resetRacers();
            setStandings(null);
          }
          const goAt = nextGoAt(goAtRef.current, Date.now(), msg.msLeft);
          const moved = goAt !== goAtRef.current;
          goAtRef.current = goAt;
          setSecs(Math.max(0, Math.ceil((goAt - Date.now()) / 1000)));
          if (isNew || phaseNow !== "countdown") setPhase("countdown");
          if (moved || isNew) scheduleGo(msg.raceId, msg.seed);
          break;
        }
        case "running":
          if (startedRef.current === msg.raceId) break;
          if (raceRef.current === msg.raceId && phaseNow === "countdown") {
            // Our local GO timer is late or missed: start now.
            void startRace(msg.raceId, msg.seed);
          } else if (
            raceRef.current !== msg.raceId ||
            phaseNow === "idle" ||
            phaseNow === "results"
          ) {
            // Joined late: watch this one, play the next.
            if (goTimer.current) clearTimeout(goTimer.current);
            goAtRef.current = null;
            raceRef.current = msg.raceId;
            resetRacers();
            setStandings(null);
            setPhase("spectate");
          }
          break;
        case "results":
          if (
            raceRef.current === msg.raceId &&
            phaseNow !== "idle" &&
            phaseNow !== "loading"
          ) {
            setStandings(msg.standings);
            setPhase("results");
          }
          break;
      }
    };

    const channel = client.channel(raceChannel(carId), {
      config: { presence: { key: riderId }, broadcast: { self: false } },
    });
    channelRef.current = channel;
    channel
      .on("broadcast", { event: RACE_EVENTS.state }, ({ payload }) =>
        onState(payload),
      )
      .on("broadcast", { event: RACE_EVENTS.pos }, ({ payload }) => {
        const p = RacePosMsg.safeParse(payload);
        if (
          !p.success ||
          p.data.riderId === riderId ||
          p.data.raceId !== raceRef.current
        )
          return;
        setRacers((prev) => mergeRacer(prev, p.data, Date.now()));
      })
      .on("presence", { event: "sync" }, () => {
        const seen = new Map<string, RacePresence>();
        for (const metas of Object.values(channel.presenceState())) {
          for (const meta of metas) {
            const p = RacePresence.safeParse(meta);
            if (p.success) seen.set(p.data.riderId, p.data);
          }
        }
        setLobby([...seen.values()]);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({
            riderId,
            name: riderName,
          } satisfies RacePresence);
          setTimeout(() => {
            if (!gotState) setNoKiosk(true);
          }, KIOSK_WAIT_MS);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError("Lost the live connection. Reload to rejoin the race.");
        }
      });

    return () => {
      if (goTimer.current) clearTimeout(goTimer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      finalTimers.current.forEach(clearTimeout);
      finalTimers.current = [];
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [riderId, riderName, carId, rideId, setPhase]);

  // Tick the countdown and standings clock.
  useEffect(() => {
    if (phase !== "countdown" && phase !== "spectate" && phase !== "done")
      return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (goAtRef.current !== null)
        setSecs(Math.max(0, Math.ceil((goAtRef.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(t);
  }, [phase]);

  const sendPos = useCallback(
    (score: number, alive: boolean) => {
      const raceId = runRef.current?.raceId;
      if (!raceId || !riderId || !riderName) return;
      const msg: RacePosMsg = {
        raceId,
        riderId,
        name: riderName,
        score: Math.round(score),
        alive,
      };
      void channelRef.current?.send({
        type: "broadcast",
        event: RACE_EVENTS.pos,
        payload: msg,
      });
      setRacers((prev) => mergeRacer(prev, msg, Date.now()));
    },
    [riderId, riderName],
  );

  const onScore = useCallback(
    (score: number) => {
      if (phaseRef.current !== "playing") return;
      const t = Date.now();
      if (!shouldSendPos(lastPosAt.current, t, RACE.POS_EVERY_MS)) return;
      lastPosAt.current = t;
      sendPos(score, true);
    },
    [sendPos],
  );

  const onGameOver = useCallback(
    async (res: RunResult) => {
      const current = runRef.current;
      // The game can replay locally; only the first result per server run counts.
      if (!current || !rideId || submitted.current === current.runId) return;
      submitted.current = current.runId;
      const score = Math.round(res.score);
      setFinishedRun(res);
      setMyScore(score);
      setPhase("done");
      sendPos(score, false);
      for (let i = 1; i < FINAL_POS_SENDS; i++) {
        finalTimers.current.push(
          setTimeout(() => sendPos(score, false), i * FINAL_POS_GAP_MS),
        );
      }
      try {
        const r = await api(
          `/api/runs/${current.runId}/finish`,
          FinishRunResponse,
          {
            body: {
              score,
              coins: Math.round(res.coins),
              durationMs: Math.round(res.durationMs),
            },
          },
        );
        lastRunStore.set({
          rideId,
          bestThisRide: r.bestThisRide,
          carRank: r.carRank,
          carLeaderboard: r.carLeaderboard,
        });
        setResult(r);
      } catch (err) {
        setError(errorText(err));
      }
    },
    [rideId, sendPos, setPhase],
  );

  const raceAgain = useCallback(() => {
    setRun(null);
    setFinishedRun(null);
    setResult(null);
    setStandings(null);
    setError(null);
    setHint(false);
    raceRef.current = null;
    goAtRef.current = null;
    setRacers(new Map());
    setPhase("idle");
  }, [setPhase]);

  const color = ride ? LINE_COLORS[ride.line] : LINE_COLORS.Green;
  const meId = riderId ?? "";
  const header = (
    <header>
      <Link href="/mobile">← MY PASS</Link>
      <span>CAR RACE{ride ? ` · ${ride.carId}` : ""}</span>
    </header>
  );
  const leave = ride ? (
    <LeaveTrain rideId={ride.id} onClose={() => router.push("/mobile")} />
  ) : null;

  if (!realtimeOk) {
    return (
      <main className="mobile-race-screen">
        {header}
        <div className="mobile-race-panel">
          <BigText sub="Car Race syncs through the kiosk. You can still play a solo run.">
            Car Race needs a live connection
          </BigText>
          <Link className="personal-button comic-type" style={{ maxWidth: 320 }} href="/mobile/game">
            PLAY SOLO
          </Link>
          {leave}
        </div>
      </main>
    );
  }

  const playing = phase === "playing" && run;
  return (
    <main className="mobile-race-screen">
      {header}
      <div className="mobile-race-body">
        {playing && (
          <GameCanvas
            key={run.raceId}
            seed={run.seed}
            lineColor={color}
            onScore={onScore}
            onGameOver={onGameOver}
          />
        )}
        {playing && hint && (
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
            <p className="rounded-full bg-hud-bg/80 px-5 py-2 font-mono text-lg">
              GO! Tap LET’S ROLL!
            </p>
          </div>
        )}
        {!playing && (
          <div className="mobile-race-panel">
            {error && <ErrorNote>{error}</ErrorNote>}
            {(phase === "loading" || phase === "starting") && (
              <BigText>
                {phase === "loading" ? "Loading…" : "Starting…"}
              </BigText>
            )}
            {phase === "idle" && (
              <>
                <BigText
                  sub={
                    noKiosk
                      ? "Make sure the kiosk page is open."
                      : "It starts as soon as the kiosk sees you."
                  }
                >
                  {noKiosk
                    ? "Waiting for the kiosk…"
                    : "Waiting for the next race…"}
                </BigText>
                <p className="text-sm text-hud-dim">
                  {present} in the lobby
                </p>
                <ul className="mobile-lobby" aria-label="Riders in this car">
                  {lobby.map((p) => (
                    <li key={p.riderId} className={p.riderId === meId ? "is-me" : ""}>
                      {p.name}
                      {p.riderId === meId ? " (you)" : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {phase === "countdown" && (
              <Countdown secs={secs} racers={present} />
            )}
            {phase === "spectate" && (
              <div className="flex w-full max-w-md flex-col gap-4">
                <BigText sub="Race in progress. You’re in the next one.">
                  Watching
                </BigText>
                <LiveStandings racers={racers} meId={meId} now={now} />
              </div>
            )}
            {(phase === "done" || phase === "results") && finishedRun && (
              <RunResults
                run={{ ...finishedRun, score: myScore }}
                source="ranked"
                boardTitle="RACE LEADERBOARD"
                boardTag={
                  phase === "results" ? "FINAL RESULTS" : "LIVE POSITIONS"
                }
                entries={
                  phase === "results"
                    ? (standings ?? []).map((r, i) => ({
                        rank: i + 1,
                        displayName: r.displayName,
                        score: r.score,
                      }))
                    : liveOrder(racers.values()).map((r, i) => ({
                        rank: i + 1,
                        displayName: r.name,
                        score: r.score,
                      }))
                }
                highlightRank={
                  phase === "results"
                    ? (standings ?? []).findIndex((r) => r.riderId === meId) + 1
                    : liveOrder(racers.values()).findIndex(
                        (r) => r.riderId === meId,
                      ) + 1
                }
                pending={!result && !error}
                error={error}
                replayDisabled={phase !== "results"}
                note={
                  phase === "results"
                    ? result?.accepted === false
                      ? "Your run did not pass validation. The final race standings are below."
                      : "The race is over. Here’s how the car finished."
                    : "Your score is in. Other riders are still running; live positions may change."
                }
                onReplay={raceAgain}
                onLeave={() => router.push("/mobile")}
                leaveLabel="BACK TO MY PASS"
              />
            )}
            {phase === "results" && !finishedRun && (
              <div className="flex w-full max-w-md flex-col gap-4">
                <BigText>Race results</BigText>
                <Podium standings={standings ?? []} meId={meId} />
                <button className="comic-button" onClick={raceAgain}>
                  JOIN THE NEXT RACE
                </button>
              </div>
            )}
            {leave}
          </div>
        )}
      </div>
    </main>
  );
}
