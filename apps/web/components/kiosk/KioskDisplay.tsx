"use client";

import { OkResponse, isRouteId, lineOfRoute } from "@cb/shared";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { LiveMap } from "@/components/map/LiveMap";
import { LineLegend } from "@/components/map/LineLegend";
import { useTrains } from "@/components/map/useTrains";
import { LeadersCard } from "@/components/site/LeadersCard";
import { PlayQrCard } from "@/components/site/PlayQrCard";
import { createDispenser, type Dispenser, type DispenserStatus } from "@/lib/adapters/dispenser";
import { readFlags } from "@/lib/adapters/flags";
import { api } from "@/lib/api-client";
import { DevPanel } from "./DevPanel";
import { useCarState, useJoinToken, useKioskKey, useWindowCountdown } from "./hooks";
import { KioskHeader } from "./KioskHeader";
import { KioskNotifications } from "./KioskNotifications";
import { RaceRail } from "./RaceRail";
import { useRaceHost } from "./useRaceHost";

const DEFAULT_CAR = "green-3812";
const OVERLAY_MS = 8000;
const CLAIM_POLL_MS = 3000;

const NextClaim = z.union([
  z.object({
    ok: z.literal(true),
    code: z.string(),
    displayName: z.string(),
    score: z.number(),
    dispenseId: z.string(),
  }),
  z.object({ ok: z.literal(false) }),
]);

type Voucher = { name: string; score: number; state: "working" | "done" | "offline" };

/** Laptop display for the car. Jeet's map/leaderboard layout + rotating car QR and race rail. Camera claims are the default; legacy auto-vouchers require ?claimMode=auto. */
export function KioskDisplay() {
  const params = useSearchParams();
  const carId = params.get("car") ?? DEFAULT_CAR;
  const flags = useMemo(() => {
    const local = new URLSearchParams(params.toString());
    if (!local.has("dispenser")) local.set("dispenser", "http");
    return readFlags(local);
  }, [params]);
  const automaticVouchers = params.get("claimMode") === "auto";
  const kioskKey = useKioskKey(params.get("key"));

  const { state, reload, realtimeHits } = useCarState(carId, kioskKey);
  const race = useRaceHost(carId, kioskKey, reload);
  const { token, error: tokenError } = useJoinToken(carId, kioskKey);
  const secondsLeft = useWindowCountdown();

  // ── Dispenser (Web Serial needs one click the first time; autoConnect for granted ports) ──
  const dispenser = useMemo<Dispenser | null>(
    () => (kioskKey ? createDispenser(flags, { kioskKey }) : null),
    [flags, kioskKey],
  );
  const [dispStatus, setDispStatus] = useState<DispenserStatus>("disconnected");
  useEffect(() => {
    if (!dispenser) return;
    const off = dispenser.onStatus((s) => setDispStatus(s));
    if ("autoConnect" in dispenser && typeof dispenser.autoConnect === "function") {
      void (dispenser as Dispenser & { autoConnect: () => Promise<boolean> }).autoConnect();
    } else {
      dispenser.connect().catch(() => undefined); // status listener shows the error
    }
    return () => {
      off();
      void dispenser.disconnect();
    };
  }, [dispenser]);
  const connectDispenser = useCallback(() => {
    dispenser?.connect().catch(() => undefined);
  }, [dispenser]);

  // ── Auto voucher: pending claim → claims/next → DISPENSE → /dispensed ──
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const inFlight = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const tryNext = useCallback(async () => {
    if (inFlight.current || !kioskKey || !dispenser) return;
    inFlight.current = true;
    try {
      const r = await api(`/api/cars/${carId}/claims/next`, NextClaim, { method: "POST", kioskKey });
      if (!r.ok) return;
      clearTimeout(hideTimer.current);
      setVoucher({ name: r.displayName, score: r.score, state: "working" });
      const result =
        dispenser.status() === "ready"
          ? await dispenser.dispense(r.dispenseId)
          : ({ ok: false, error: `dispenser ${dispenser.status()}` } as const);
      await api(`/api/claims/${r.code}/dispensed`, OkResponse, {
        body: result.ok ? { status: "done" } : { status: "error", detail: result.error.slice(0, 200) },
        kioskKey,
      }).catch(() => undefined);
      setVoucher({ name: r.displayName, score: r.score, state: result.ok ? "done" : "offline" });
      hideTimer.current = setTimeout(() => setVoucher(null), OVERLAY_MS);
      void reload();
    } catch {
      /* network/auth hiccup: the poll or next broadcast retries */
    } finally {
      inFlight.current = false;
    }
  }, [carId, dispenser, kioskKey, reload]);

  const hasPending = !!state?.pendingClaim;
  useEffect(() => {
    if (!hasPending || !automaticVouchers) return;
    const first = setTimeout(() => void tryNext(), 0);
    const t = setInterval(() => void tryNext(), CLAIM_POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [hasPending, automaticVouchers, tryNext]);

  // ── Hidden status panel: Shift+D ──
  const [panel, setPanel] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if ((e.key === "d" || e.key === "D") && e.shiftKey) setPanel((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const car = kioskKey ? { url: token?.url ?? null, secondsLeft, error: tokenError } : undefined;
  const ok = dispStatus === "ready" || dispStatus === "busy";

  return (
    <main className="kiosk-display">
      <KioskHeader current="map" />
      <section className="display-map" aria-label="Boston live transit map">
        <LiveMap />
        <KioskNotifications />
        <div className="display-legend">
          <LineLegend chips />
        </div>
        {kioskKey && (
          <div className="kcar-status">
            <span className="kcar-chip">
              {carId.toUpperCase()}
              {state ? ` · ${state.activeRiders} RIDER${state.activeRiders === 1 ? "" : "S"}` : ""}
            </span>
            {ok || dispenser?.kind !== "web-serial" ? (
              <span className="kcar-chip" data-ok={ok} data-warn={!ok}>
                DISPENSER {ok ? "CONNECTED" : "OFFLINE"} ({dispenser?.kind})
              </span>
            ) : (
              <button type="button" className="kcar-chip" data-warn onClick={connectDispenser}>
                DISPENSER {dispStatus === "connecting" ? "CONNECTING…" : "OFFLINE · CLICK TO CONNECT"}
              </button>
            )}
          </div>
        )}
        <aside className="display-rail" aria-label="Leaderboard, race and passenger QR">
          <LeadersCard />
          {kioskKey && <RaceRail race={race} />}
          <PlayQrCard car={car} />
        </aside>
      </section>

      {voucher && (
        <div className="kcar-voucher" role="alert" aria-live="assertive">
          <div>
            <h2>🏆 {voucher.name} is #1 — collect your voucher!</h2>
            <p className="sub">{voucher.score.toLocaleString()} points</p>
            {voucher.state === "offline" && (
              <p className="note">The dispenser is offline. Please collect your voucher from the crew.</p>
            )}
            {voucher.state === "working" && <p className="note">Dispensing…</p>}
          </div>
        </div>
      )}

      {panel && kioskKey && dispenser && (
        <DevPanelHost
          carId={carId}
          kioskKey={kioskKey}
          flags={flags}
          dispenser={dispenser}
          dispStatus={dispStatus}
          realtimeHits={realtimeHits}
          replayFile={params.get("replay")}
          vehicleParam={params.get("vehicle")}
          carVehicleId={state?.car.vehicleId ?? null}
          line={state?.car.line ?? "Green"}
          reload={reload}
          onClose={() => setPanel(false)}
          onTestCode={() => void tryNext()}
        />
      )}
    </main>
  );
}

/** Mounted only while Shift+D is open, so the extra train feed only runs then. */
function DevPanelHost(props: {
  carId: string;
  kioskKey: string;
  flags: ReturnType<typeof readFlags>;
  dispenser: Dispenser;
  dispStatus: DispenserStatus;
  realtimeHits: number;
  replayFile: string | null;
  vehicleParam: string | null;
  carVehicleId: string | null;
  line: "Red" | "Orange" | "Blue" | "Green";
  reload: () => Promise<void>;
  onClose: () => void;
  onTestCode: () => void;
}) {
  const trains = useTrains({ feed: props.flags.feed, replayFile: props.replayFile ?? undefined });
  const lineVehicles = (trains.snapshot?.vehicles ?? []).filter(
    (v) => isRouteId(v.route) && lineOfRoute(v.route) === props.line,
  );
  return (
    <DevPanel
      carId={props.carId}
      kioskKey={props.kioskKey}
      flags={props.flags}
      feedMode={trains.mode}
      setFeedMode={trains.setMode}
      feedError={trains.error}
      dispenser={props.dispenser}
      dispenserStatus={props.dispStatus}
      realtimeHits={props.realtimeHits}
      youVehicleId={props.vehicleParam ?? props.carVehicleId}
      lineVehicles={lineVehicles}
      onPinned={props.reload}
      onClose={props.onClose}
      onTestCode={props.onTestCode}
    />
  );
}
