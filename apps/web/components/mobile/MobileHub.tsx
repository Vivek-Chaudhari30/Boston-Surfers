"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { rewardCatalog } from "@/lib/reward-catalog";
import type { Award } from "@/lib/awards-logic";
import { ArcadeBrand } from "@/components/play/ArcadeBrand";
import { RewardClaim } from "./RewardClaim";
import { DemoRewardPass } from "./DemoRewardPass";
import { createDemoReward, type DemoReward } from "@/lib/demo-reward";
import { LeaveTrain } from "./LeaveTrain";
import { MobileNav, type MobileSection } from "./MobileNav";
import { readPersonalPractice, type PersonalPractice } from "./practice-history";
import { useMobilePass } from "./useMobilePass";

const TITLES: Record<MobileSection, string> = {
  play: "YOUR NEXT ADVENTURE.",
  rewards: "YOUR WINNING STREAK.",
  history: "YOUR STORY SO FAR.",
  profile: "YOUR PASSENGER PASS.",
};

function SignupCard({
  busy,
  onSubmit,
  heading,
}: {
  busy: boolean;
  onSubmit: (name: string, phone: string) => void;
  heading: string;
}) {
  return (
    <section className="personal-card">
      <h2 className="comic-type">{heading}</h2>
      <p>Your name and phone number open your pass. Use the same details later to come back to it.</p>
      <form
        className="passenger-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSubmit(String(f.get("name")), String(f.get("phone")));
        }}
      >
        <label>
          Display name
          <input required name="name" minLength={2} maxLength={16} autoComplete="nickname" />
        </label>
        <label>
          Phone number
          <input required name="phone" type="tel" autoComplete="tel" placeholder="617 555 0123" />
        </label>
        <button className="personal-button" disabled={busy}>
          {busy ? "CONNECTING…" : "OPEN MY PASS"}
        </button>
      </form>
    </section>
  );
}

function awardStatus(a: Award, now: number): "Collected" | "Processing" | "Ready" | "Expired" | null {
  if (!a.claim) return null;
  if (a.claim.redeemedAt) return a.claim.dispenseStatus === "done" ? "Collected" : "Processing";
  return Date.parse(a.claim.expiresAt) > now ? "Ready" : "Expired";
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function MobileHub({ section }: { section: MobileSection }) {
  const router = useRouter();
  const params = useSearchParams();
  const pass = useMobilePass();
  const { me, profile, loading, car, token } = pass;
  const [practice, setPractice] = useState<PersonalPractice[]>([]);
  const [now, setNow] = useState(0);
  const [claim, setClaim] = useState<{ code: string; expiresAt: string } | null>(null);

  const [demoReward, setDemoReward] = useState<DemoReward | null>(null);

  const selectedClaim = claim?.code ?? params.get("claim");

  useEffect(() => {
    const refresh = () => {
      setNow(Date.now());
      setPractice(readPersonalPractice());
    };
    const first = setTimeout(refresh, 0);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(first);
      clearInterval(clock);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const rider = me?.rider ?? null;
  const joining = Boolean(car && token);
  const best = Math.max(
    0,
    profile?.stats.bestScore ?? 0,
    ...practice.map((r) => r.score),
  );
  const signedIn = Boolean(rider);

  // Scanned the kiosk QR while signed out: the form is the whole screen.
  if (!loading && !signedIn && joining) {
    return (
      <main className="passenger-shell">
        <header className="passenger-header">
          <ArcadeBrand href="/mobile" />
          <span>JOIN THE RACE</span>
        </header>
        <div className="passenger-content">
          <h1 className="comic-type">JUMP IN!</h1>
          {pass.signedOutNote && (
            <p className="passenger-message">Details cleared on this phone.</p>
          )}
          {pass.error && <p className="passenger-message" role="alert">{pass.error}</p>}
          <SignupCard heading="WHO’S RIDING?" busy={pass.busy} onSubmit={pass.signup} />
        </div>
      </main>
    );
  }

  return (
    <main className="passenger-shell">
      <header className="passenger-header">
        <ArcadeBrand href="/mobile" />
        <span>YOUR PERSONAL PASS</span>
      </header>
      <div className="passenger-content">
        <p className="display-eyebrow">
          {rider ? `HEY, ${rider.displayName.toUpperCase()}` : "WELCOME ABOARD"}
        </p>
        <h1 className="comic-type">{TITLES[section]}</h1>
        {pass.welcomeBack && (
          <p className="mobile-welcome" role="status">
            Welcome back, {pass.welcomeBack}
          </p>
        )}
        {pass.expired && (
          <p className="passenger-message" role="alert">
            That QR code expired. Scan the kiosk screen again to join the car.
          </p>
        )}
        {pass.error && (
          <p className="passenger-message" role="status">
            {pass.error} <button onClick={() => void pass.refresh()}>Retry</button>
          </p>
        )}
        {loading && <p className="personal-footnote">Opening your pass…</p>}

        {!loading && !signedIn && section !== "play" && (
          <SignupCard heading="OPEN YOUR PASS." busy={pass.busy} onSubmit={pass.signup} />
        )}

        {section === "play" && (
          <>
            {!loading && !signedIn && (
              <SignupCard heading="OPEN YOUR PASS." busy={pass.busy} onSubmit={pass.signup} />
            )}
            <section className="personal-hero">
              <span>YOUR PERSONAL BEST</span>
              <strong className="comic-type">{best.toLocaleString()}</strong>
              <p>One city. Three tracks. Your next personal best.</p>
              {me?.activeRide && (
                <Link className="personal-button comic-type" href="/mobile/race">
                  CAR RACE LOBBY ↗
                </Link>
              )}
              <Link
                className="personal-button comic-type"
                style={me?.activeRide ? { background: "#8ce5d3" } : undefined}
                href="/mobile/game"
              >
                {me?.activeRide ? "SOLO RUN ↗" : "LET’S ROLL! ↗"}
              </Link>
              <button className="personal-button comic-type demo-getting-off" onClick={() => setDemoReward(createDemoReward())}>I am Getting off</button>
            </section>
            <div className="personal-stats">
              <div>
                <strong>{profile?.stats.plays ?? 0}</strong>
                <span>Plays</span>
              </div>
              <div>
                <strong>{profile?.stats.wins ?? 0}</strong>
                <span>Wins</span>
              </div>
            </div>
            <section className="personal-card">
              <h2 className="comic-type">YOUR RIDE</h2>
              <p>
                {me?.activeRide
                  ? `You’re aboard ${me.activeRide.carId}. Races and solo runs count toward this car.`
                  : "Jump into practice now. Scan a car’s kiosk QR to race and play for the car voucher."}
              </p>
            </section>
            {me?.activeRide && (
              <details className="demo-ranked-actions"><summary>Ranked ride options</summary><LeaveTrain rideId={me.activeRide.id} onClose={() => void pass.refresh()} /></details>
            )}
            <p className="personal-footnote">
              Practice stays on this phone. Ranked runs and winnings sync to your account.
            </p>
          </>
        )}

        {section === "history" && (
          <>
            <h2 className="comic-type">EVERY PLAY</h2>
            {!profile?.plays.length ? (
              <section className="personal-card">
                <p>
                  {loading
                    ? "Loading your plays…"
                    : signedIn
                      ? "No plays yet. Join a car and play your first run."
                      : "Open your pass to sync your play history."}
                </p>
              </section>
            ) : (
              profile.plays.map((p) => (
                <article className="personal-history-row" key={p.id}>
                  <div>
                    <strong>{p.score?.toLocaleString() ?? "—"} pts</strong>
                    <p>
                      {p.carId} · {p.status}
                    </p>
                    <time>
                      {fmtDate(p.playedAt)} · {fmtTime(p.playedAt)}
                    </time>
                  </div>
                  <span>{p.coins ?? 0} coins</span>
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
            {selectedClaim && (
              <RewardClaim
                key={selectedClaim}
                code={selectedClaim}
                onDone={() => {
                  setClaim(null);
                  router.replace("/mobile/rewards");
                  void pass.refresh();
                }}
              />
            )}
            {profile && (
              <div className="mobile-types">
                {profile.awardTypes.map((t) => (
                  <div key={t.id}>
                    <span className="icon" aria-hidden>{t.icon}</span>
                    <strong>{t.count}</strong>
                    <span className="name">{t.name}</span>
                  </div>
                ))}
              </div>
            )}
            {profile && !profile.awards.length && (
              <section className="personal-card empty-personal">
                <span aria-hidden>★</span>
                <h2 className="comic-type">YOUR FIRST WIN IS AHEAD.</h2>
                <p>Lead your car, podium a race or hit a milestone. Wins show up here.</p>
              </section>
            )}
            {profile?.awardTypes
              .filter((t) => profile.awards.some((a) => a.typeId === t.id))
              .map((t) => (
                <div key={t.id}>
                  <h2 className="comic-type" style={{ color: "#8ce5d3", fontSize: 21, margin: "20px 0 8px" }}>
                    {t.icon} {t.name.toUpperCase()} · {t.count}
                  </h2>
                  {profile.awards
                    .filter((a) => a.typeId === t.id)
                    .map((a) => {
                      const status = awardStatus(a, now);
                      return (
                        <article className="personal-card" key={a.id}>
                          <h2 className="comic-type" style={{ fontSize: 20 }}>{a.title}</h2>
                          <p>
                            {fmtDate(a.wonAt)}
                            {a.score != null && ` · ${a.score.toLocaleString()} pts`}
                            {a.rank != null && ` · #${a.rank}`}
                            {a.carId && ` · ${a.carId}`}
                          </p>
                          {status && (
                            <p>
                              <span className={`mobile-chip ${status.toLowerCase()}`}>
                                {status === "Ready" ? "READY TO COLLECT" : status.toUpperCase()}
                              </span>
                            </p>
                          )}
                          {a.offers.map((o) => (
                            <p key={o}>Unlocks: {o}</p>
                          ))}
                          {a.claim && (status === "Ready" || status === "Processing") && (
                            <button
                              className="personal-button"
                              onClick={() => setClaim({ code: a.claim!.code, expiresAt: a.claim!.expiresAt })}
                            >
                              SHOW MY REWARD QR
                            </button>
                          )}
                        </article>
                      );
                    })}
                </div>
              ))}
            <h2 className="comic-type">DEMO QUEST UNLOCKS</h2>
            <p className="personal-footnote">
              Prototype rewards from your own scores. Not merchant-approved or redeemable.
            </p>
            {rewardCatalog
              .filter((reward) => best >= reward.points)
              .map((reward) => (
                <article className="personal-card" key={reward.id}>
                  <p className="display-eyebrow">DEMO UNLOCK · {reward.points} POINTS</p>
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
          </>
        )}

        {section === "profile" && signedIn && (
          <>
            <section className="personal-card">
              <p className="display-eyebrow">SIGNED IN</p>
              <h2 className="comic-type">{profile?.rider.displayName ?? rider?.displayName}</h2>
              {profile && (
                <p>
                  {profile.rider.phoneMasked}
                  <br />
                  Member since {fmtDate(profile.rider.memberSince)}
                </p>
              )}
            </section>
            {profile && (
              <>
                <div className="mobile-stats-5">
                  <div><strong>{profile.stats.plays}</strong><span>Plays</span></div>
                  <div><strong>{profile.stats.bestScore.toLocaleString()}</strong><span>Best score</span></div>
                  <div><strong>{profile.stats.totalCoins.toLocaleString()}</strong><span>Coins</span></div>
                  <div><strong>{profile.stats.daysPlayed}</strong><span>Days played</span></div>
                  <div><strong>{profile.stats.wins}</strong><span>Wins</span></div>
                </div>
                <div className="mobile-types">
                  {profile.awardTypes.map((t) => (
                    <div key={t.id}>
                      <span className="icon" aria-hidden>{t.icon}</span>
                      <strong>{t.count}</strong>
                      <span className="name">{t.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <button className="mobile-link-button" onClick={pass.signOutLocal}>
              Not you? Sign out of this phone
            </button>
            <p className="personal-footnote">
              This clears your saved details on this phone and switches you to a new sign-in.
            </p>
          </>
        )}
      </div>
      <MobileNav current={section} />
      {demoReward && <DemoRewardPass reward={demoReward} onClose={() => setDemoReward(null)} />}
    </main>
  );
}
