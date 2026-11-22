"use client";
import Link from "next/link";
import { useState } from "react";
import { EndRideResponse } from "@cb/shared";
import { ApiClientError, api, errorText } from "@/lib/api-client";
import { ClaimView } from "@/components/play/ClaimView";

type Stage = "idle" | "confirm" | "busy" | "result";

/** "I'M LEAVING THE TRAIN": confirm, end the ride, show the outcome. */
export function LeaveTrain({
  rideId,
  onClose,
}: {
  rideId: string;
  /** Called when the rider dismisses the result. */
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<EndRideResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function end() {
    setStage("busy");
    setError(null);
    try {
      const r = await api(`/api/rides/${rideId}/end`, EndRideResponse, {
        method: "POST",
      });
      setResult(r);
      setStage("result");
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.code === "NOT_ENOUGH_RIDERS"
          ? "Not enough riders in this car for a winner yet. Your ride is still open."
          : errorText(err),
      );
      setStage("idle");
    }
  }

  if (stage === "result" && result) {
    return (
      <div className="mobile-leave-overlay" role="dialog" aria-modal="true">
        {result.result === "won" && (
          <>
            <h2 className="comic-type">YOU’RE #1 IN THIS CAR</h2>
            <p>Collect your voucher at the kiosk screen.</p>
            <p style={{ fontSize: 13, opacity: 0.8 }}>
              Backup code if the kiosk doesn’t react:
            </p>
            <ClaimView claim={result.claim} onDone={onClose} />
          </>
        )}
        {result.result === "not_leader" && (
          <>
            <h2 className="comic-type">RIDE COMPLETE</h2>
            <p>
              You finished #{result.rank}. Leader: {result.leader.displayName}{" "}
              {result.leader.score.toLocaleString()}
            </p>
          </>
        )}
        {result.result === "no_score" && (
          <>
            <h2 className="comic-type">RIDE COMPLETE</h2>
            <p>You didn’t post a ranked score this ride. Next time!</p>
          </>
        )}
        {result.result === "already_claimed_today" && (
          <>
            <h2 className="comic-type">NICE RIDE</h2>
            <p>You already earned today’s sticker.</p>
          </>
        )}
        {result.result !== "won" && (
          <button className="personal-button" onClick={onClose}>
            DONE
          </button>
        )}
        <Link href="/mobile/rewards" className="personal-secondary" style={{ color: "#8ce5d3" }}>
          MY WINNINGS ★
        </Link>
      </div>
    );
  }

  return (
    <div className="mobile-leave-wrap">
      {error && (
        <p className="passenger-message" role="alert">
          {error}
        </p>
      )}
      {stage === "confirm" ? (
        <div>
          <p style={{ textAlign: "center", fontSize: 14 }}>
            End your ride? If you lead this car, your voucher is issued.
          </p>
          <div className="mobile-leave-confirm">
            <button className="personal-button" onClick={() => setStage("idle")}>
              STAY
            </button>
            <button
              className="personal-button"
              style={{ background: "#ff6a94" }}
              onClick={() => void end()}
            >
              YES, LEAVING
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mobile-leave"
          disabled={stage === "busy"}
          onClick={() => setStage("confirm")}
        >
          {stage === "busy" ? "CHECKING…" : "I’M LEAVING THE TRAIN"}
        </button>
      )}
    </div>
  );
}
