"use client";
import { useState } from "react";
import {
  businessMapUrl,
  rewardCatalog,
  rewardStations,
} from "@/lib/reward-catalog";

export function StationRewards() {
  const [selected, setSelected] = useState<string>("bu-central");
  const station = rewardStations.find((s) => s.id === selected)!;
  const offers = rewardCatalog.filter((r) => r.station === selected);
  return (
    <section className="rewards-content" aria-labelledby="rewards-title">
      <header className="rewards-title-row">
        <div>
          <p className="display-eyebrow">
            STEP OFF THE T. DISCOVER YOUR NEIGHBORHOOD.
          </p>
          <h1 id="rewards-title" className="comic-type">
            NEXT STOP: SOMETHING GOOD.
          </h1>
        </div>
        <p className="catalog-disclaimer">
          REAL BOSTON PLACES / DEMO OFFERS
          <br />
          <span>Proposed discounts · not merchant-approved or redeemable</span>
        </p>
      </header>
      <div className="station-tabs" role="group" aria-label="Choose a station">
        {rewardStations.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            aria-pressed={selected === s.id}
          >
            <span className="station-line">{s.line}</span>
            <strong>{s.name}</strong>
            <small>
              {rewardCatalog.filter((r) => r.station === s.id).length} demo
              rewards
            </small>
          </button>
        ))}
      </div>
      <header className="station-heading">
        <div>
          <h2 className="comic-type">AROUND {station.name.toUpperCase()}</h2>
          <p>{station.area}</p>
        </div>
        <span>{offers.length} QUEST REWARDS TO DISCOVER</span>
      </header>
      <div className="coupon-grid">
        {offers.map((reward) => (
          <article
            className="coupon"
            key={reward.id}
            style={{ "--coupon": reward.color } as React.CSSProperties}
          >
            <div className="coupon-top">
              <span>{reward.category}</span>
              <span>DEMO OFFER</span>
            </div>
            <p className="coupon-value comic-type">{reward.offer}</p>
            <h2>{reward.place}</h2>
            <p className="coupon-merchant">{reward.address}</p>
            <p className="coupon-description">{reward.detail}</p>
            <div className="coupon-quest">
              <b>{reward.points} POINTS</b>
              <span>Prototype unlock target</span>
            </div>
            <footer>
              <a
                href={businessMapUrl(reward.place, reward.address)}
                target="_blank"
                rel="noreferrer"
              >
                GOOGLE MAPS ↗
              </a>
              <a href={reward.source} target="_blank" rel="noreferrer">
                PLACE DETAILS ↗
              </a>
            </footer>
          </article>
        ))}
      </div>
      <footer className="rewards-footer">
        <span>PUBLIC REWARDS CATALOGUE</span>
        <p>
          Play on your phone. Your personal winnings and history stay in your
          passenger pass.
        </p>
        <strong>
          Businesses and addresses are real. These proposed offers are not
          redeemable.
        </strong>
      </footer>
    </section>
  );
}
