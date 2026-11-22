"use client";

import type { Entry } from "@cb/shared";
import type { RunResult } from "@cb/game";
import { useEffect, useRef, type CSSProperties } from "react";

export function ComicBoard({
  entries,
  highlightRank,
}: {
  entries: Entry[];
  highlightRank?: number | null;
}) {
  if (!entries.length)
    return (
      <p className="comic-results-empty">
        No finished runs yet. Your origin story starts here.
      </p>
    );
  return (
    <ol className="comic-board">
      {entries.map((e, index) => (
        <li
          key={`${e.rank}-${e.displayName}`}
          className={e.rank === highlightRank ? "is-you" : ""}
          style={{ "--row": index } as CSSProperties}
        >
          <span className="comic-board-rank">
            {String(e.rank).padStart(2, "0")}
          </span>
          <span className="comic-board-name">
            {e.displayName}
            {e.rank === highlightRank && <small>YOU</small>}
          </span>
          <span className="comic-board-score">{e.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

export function RunResults({
  run,
  entries,
  highlightRank,
  pending = false,
  error,
  source,
  note,
  onReplay,
  onLeave,
  leaveLabel = "BACK TO THE CITY",
  replayDisabled = false,
  boardTitle,
  boardTag,
}: {
  run: RunResult;
  entries: Entry[];
  highlightRank?: number | null;
  pending?: boolean;
  error?: string | null;
  source: "practice" | "ranked" | "local-race";
  note?: string;
  onReplay: () => void;
  onLeave?: () => void;
  leaveLabel?: string;
  replayDisabled?: boolean;
  boardTitle?: string;
  boardTag?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const replay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    panel.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      className="comic-results-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comic-result-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && onLeave) onLeave();
        if (e.key === "Tab") {
          const buttons = panel.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          );
          const first = buttons?.[0],
            last = buttons?.[buttons.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (
            !e.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div className="comic-results" ref={panel} tabIndex={-1}>
        <div className="comic-results-poster">
          <p className="comic-results-kicker">
            {source === "practice"
              ? "PRACTICE ISSUE · BOSTON EDITION"
              : "BOSTON SURFERS · RUN COMPLETE"}
          </p>
          <h2 id="comic-result-title">THAT’S A WRAP!</h2>
          <div className="comic-score" aria-label={`${run.score} points`}>
            {run.score.toLocaleString()}
          </div>
          <p className="comic-score-label">YOUR SCORE</p>
          <div className="comic-results-stats">
            <span>★ {run.coins} COINS</span>
            <span>{Math.floor(run.distance)} METRES</span>
            <span>{(run.durationMs / 1000).toFixed(1)} SEC</span>
          </div>
        </div>
        <div className="comic-results-body">
          <p className="comic-results-status" role="status">
            {pending
              ? "Checking your score and updating the car leaderboard…"
              : (note ??
                (source === "practice"
                  ? "Your run is saved on this device. Ready for your next issue?"
                  : "Your run is complete."))}
          </p>
          {error && (
            <p className="comic-results-error" role="alert">
              {error}
            </p>
          )}
          <div className="comic-results-heading">
            <h3>
              {boardTitle ??
                (source === "practice"
                  ? "YOUR HALL OF FAME"
                  : "CAR LEADERBOARD")}
            </h3>
            <span>
              {boardTag ??
                (source === "practice"
                  ? "THIS DEVICE"
                  : pending
                    ? "UPDATING"
                    : error
                      ? "UNCONFIRMED"
                      : "SERVER STANDINGS")}
            </span>
          </div>
          {pending && entries.length === 0 ? (
            <p className="comic-results-empty" role="status">
              Updating the leaderboard. Your score is shown above.
            </p>
          ) : (
            <ComicBoard entries={entries} highlightRank={highlightRank} />
          )}
          {source === "practice" && (
            <p className="comic-board-caption">
              Practice runs only. Join a car from its kiosk QR to compete with
              other riders.
            </p>
          )}
          {source === "ranked" && pending && entries.length > 0 && (
            <p className="comic-board-caption">
              Showing the last known standings until your result is confirmed.
            </p>
          )}
          <button
            ref={replay}
            className="comic-button"
            onClick={onReplay}
            disabled={pending || replayDisabled}
          >
            RUN IT BACK!
          </button>
          {onLeave && (
            <button className="comic-button secondary" onClick={onLeave}>
              {leaveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
