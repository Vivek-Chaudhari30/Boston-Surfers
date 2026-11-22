"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CreateRiderResponse,
  CreateRideResponse,
  MeResponse,
  EndRideResponse,
} from "@cb/shared";
import { api, errorText, toE164 } from "@/lib/api-client";
import { rewardCatalog } from "@/lib/reward-catalog";
import { MobileHistory } from "@/lib/mobile-history";
import { ArcadeBrand } from "@/components/play/ArcadeBrand";
import { ClaimView } from "@/components/play/ClaimView";
import { MobileNav, type MobileSection } from "./MobileNav";
import {
  readPersonalPractice,
  type PersonalPractice,
} from "./practice-history";

export function MobileHub({ section }: { section: MobileSection }) {
  const params = useSearchParams();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [history, setHistory] = useState<MobileHistory | null>(null);
  const [practice, setPractice] = useState<PersonalPractice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [claim, setClaim] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const car = params.get("car"),
    token = params.get("t");

  const load = useCallback(async () => {
    setError(null);
    try {
      const current = await api("/api/me", MeResponse);
      setMe(current);
      if (current.rider) {
        if (car && token) {
          if (current.activeRide?.carId !== car)
            await api("/api/rides", CreateRideResponse, {
              body: { carId: car, joinToken: token },
            });
          router.replace("/mobile");
        }
        setHistory(await api("/api/mobile/history", MobileHistory));
      } else setHistory(null);
    } catch {
      setError(
        "Account sync is unavailable. You can still play practice runs on this phone.",
      );
    } finally {
      setLoading(false);
    }
  }, [car, token, router]);

  useEffect(() => {
    const refresh = () => {
      setNow(Date.now());
      setPractice(readPersonalPractice());
      void load();
    };
    const first = setTimeout(refresh, 0);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(first);
      clearInterval(clock);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  async function signup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const fields = new FormData(event.currentTarget);
    try {
      await api("/api/riders", CreateRiderResponse, {
        body: {
          displayName: String(fields.get("name")).trim(),
          phone: toE164(String(fields.get("phone"))),
        },
      });
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function endRide() {
    if (!me?.activeRide) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api(
        `/api/rides/${me.activeRide.id}/end`,
        EndRideResponse,
        { method: "POST" },
      );
      if (result.result === "won") setClaim(result.claim);
      else
        setNotice(
          result.result === "already_claimed_today"
            ? "You already earned today’s sticker."
            : "Ride completed. Your runs are in History.",
        );
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  const best = Math.max(
    0,
    ...(history?.runs
      .filter((r) => r.status === "finished")
      .map((r) => r.score ?? 0) ?? []),
    ...practice.map((r) => r.score),
  );
  return (
    <main className="passenger-shell">
      <header className="passenger-header">
        <ArcadeBrand href="/mobile" />
        <span>YOUR PERSONAL PASS</span>
      </header>
      <div className="passenger-content">
        <p className="display-eyebrow">
          {me?.rider
            ? `HEY, ${me.rider.displayName.toUpperCase()}`
            : "WELCOME ABOARD"}
        </p>
        <h1 className="comic-type">
          {
            {
              play: "YOUR NEXT ADVENTURE.",
              rewards: "YOUR WINNING STREAK.",
              history: "YOUR STORY SO FAR.",
              profile: "YOUR PASSENGER PASS.",
            }[section]
          }
        </h1>
        {error && (
          <p className="passenger-message" role="status">
            {error} <button onClick={() => void load()}>Retry sync</button>
          </p>
        )}
        {notice && (
          <p className="passenger-message" role="status">
            {notice}
          </p>
        )}
        {section === "play" && (
          <>
            <section className="personal-hero">
              <span>YOUR PERSONAL BEST</span>
              <strong className="comic-type">{best.toLocaleString()}</strong>
              <p>One city. Three tracks. Your next personal best.</p>
              <Link className="personal-button comic-type" href="/mobile/game">
                LET’S ROLL! ↗
              </Link>
            </section>
            <div className="personal-stats">
              <div>
                <strong>{history?.runs.length ?? 0}</strong>
                <span>Saved ranked runs</span>
              </div>
              <div>
                <strong>{history?.rewards.length ?? 0}</strong>
                <span>Personal winnings</span>
              </div>
            </div>
            <section className="personal-card">
              <h2 className="comic-type">YOUR RIDE</h2>
              <p>
                {me?.activeRide
                  ? `You’re aboard ${me.activeRide.carId}. Your next game counts toward this car’s score.`
                  : "Jump into practice now. Scan a live car’s join QR to play for a car reward."}
              </p>
            </section>
            <p className="personal-footnote">
              Practice stays on this phone. Ranked runs and winnings sync to
              your signed-in account.
            </p>
          </>
        )}
        {section === "history" && (
          <>
            <p className="personal-footnote">
              Your latest 50 ranked runs and 50 phone practice runs. Only your
              account’s records appear here.
            </p>
            <h2 className="comic-type">RANKED RUNS</h2>
            {!history?.runs.length ? (
              <section className="personal-card">
                <p>
                  {loading
                    ? "Loading your runs…"
                    : me?.rider
                      ? "No ranked runs yet. Join a car and play your first run."
                      : "Sign in from Profile to sync your ranked history."}
                </p>
              </section>
            ) : (
              history.runs.map((run) => (
                <article className="personal-history-row" key={run.id}>
                  <div>
                    <strong>{run.score?.toLocaleString() ?? "—"} pts</strong>
                    <p>
                      {run.car_id} · {run.status}
                    </p>
                    <time>
                      {run.finished_at
                        ? new Date(run.finished_at).toLocaleString()
                        : "Pending"}
                    </time>
                  </div>
                  <span>{run.coins ?? 0} coins</span>
                </article>
              ))
            )}
            <h2 className="comic-type">ON THIS PHONE · PRACTICE</h2>
            {!practice.length ? (
              <section className="personal-card">
                <p>Your first practice run is waiting.</p>
              </section>
            ) : (
              practice.map((run) => (
                <article className="personal-history-row" key={run.id}>
                  <div>
                    <strong>{run.score.toLocaleString()} pts</strong>
                    <p>
                      {Math.floor(run.distance)} metres · {run.coins} coins
                    </p>
                    <time>{new Date(run.at).toLocaleString()}</time>
                  </div>
                  <span>PRACTICE</span>
                </article>
              ))
            )}
          </>
        )}
        {section === "rewards" && (
          <>
            <p className="personal-footnote">
              Earned rewards belong to your passenger account. Public coupon
              ideas on the kiosk aren’t automatically added here.
            </p>
            {claim ? (
              <ClaimView
                claim={claim}
                onDone={() => {
                  setClaim(null);
                  void load();
                }}
              />
            ) : null}
            {!history?.rewards.length ? (
              <section className="personal-card empty-personal">
                <span aria-hidden>★</span>
                <h2 className="comic-type">YOUR FIRST WIN IS AHEAD.</h2>
                <p>
                  {me?.rider
                    ? "Lead your car when you end your ride to earn a Boston sticker. Your actual wins will appear here."
                    : "Sign in from Profile to see your own winnings."}
                </p>
              </section>
            ) : (
              history.rewards.map((reward) => (
                <article className="personal-card" key={reward.id}>
                  <p className="display-eyebrow">BOSTON CITY KEEPSAKE</p>
                  <h2 className="comic-type">CAR CHAMPION STICKER</h2>
                  <p>
                    {reward.car_id} · {reward.score.toLocaleString()} pts
                  </p>
                  <p>
                    {reward.redeemed_at
                      ? reward.dispense_status === "done"
                        ? "Collected"
                        : "Claim confirmed · collect from the crew"
                      : Date.parse(reward.expires_at) > now
                        ? "Ready to claim"
                        : "Claim expired"}
                  </p>
                  {!reward.redeemed_at &&
                    Date.parse(reward.expires_at) > now && (
                      <button
                        className="personal-button"
                        onClick={() =>
                          setClaim({
                            code: reward.code,
                            expiresAt: reward.expires_at,
                          })
                        }
                      >
                        SHOW MY CLAIM QR
                      </button>
                    )}
                </article>
              ))
            )}
            <h2 className="comic-type">DEMO QUEST UNLOCKS</h2>
            <p className="personal-footnote">
              Prototype rewards from your own scores. Not merchant-approved or
              redeemable.
            </p>
            {rewardCatalog
              .filter((reward) => best >= reward.points)
              .map((reward) => (
                <article className="personal-card" key={reward.id}>
                  <p className="display-eyebrow">
                    DEMO UNLOCK · {reward.points} POINTS
                  </p>
                  <h2 className="comic-type">{reward.offer}</h2>
                  <p>{reward.place}</p>
                  <p>{reward.detail}</p>
                </article>
              ))}
            {best < 250 && (
              <section className="personal-card">
                <p>Score 250 points to unlock your first demo quest reward.</p>
              </section>
            )}
            {me?.activeRide && (
              <button
                className="personal-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "End this ride? If you lead the car, your reward claim will appear here.",
                    )
                  )
                    void endRide();
                }}
              >
                I’M GETTING OFF · CHECK MY WIN
              </button>
            )}
          </>
        )}
        {section === "profile" && (
          <section className="personal-card">
            {me?.rider ? (
              <>
                <p className="display-eyebrow">SIGNED IN</p>
                <h2 className="comic-type">{me.rider.displayName}</h2>
                <p>
                  Your history and reward claims are fetched using your
                  passenger session. They aren’t displayed on the kiosk.
                </p>
                <p className="personal-footnote">
                  Keep this browser session to return to your passenger pass.
                </p>
              </>
            ) : (
              <>
                <h2 className="comic-type">SAVE YOUR CITY STORY.</h2>
                <p>
                  Use the same details to return to your existing passenger
                  account.
                </p>
                <form onSubmit={signup} className="passenger-form">
                  <label>
                    Display name
                    <input
                      required
                      name="name"
                      minLength={2}
                      maxLength={16}
                      autoComplete="nickname"
                    />
                  </label>
                  <label>
                    Phone number
                    <input
                      required
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="617 555 0123"
                    />
                  </label>
                  <button className="personal-button" disabled={busy}>
                    {busy ? "CONNECTING…" : "OPEN MY PASS"}
                  </button>
                </form>
                <p className="personal-footnote">
                  Account sync needs the secure deployed site. You can play
                  practice without signing in.
                </p>
              </>
            )}
          </section>
        )}
      </div>
      <MobileNav current={section} />
    </main>
  );
}
