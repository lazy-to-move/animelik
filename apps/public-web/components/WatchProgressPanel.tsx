"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicWatchlistItem } from "../lib/api";

type WatchProgressPanelProps = {
  animeId: number;
  episodeNumber: number;
  initialItem: PublicWatchlistItem | null;
  isSignedIn: boolean;
};

export function WatchProgressPanel({
  animeId,
  episodeNumber,
  initialItem,
  isSignedIn,
}: WatchProgressPanelProps) {
  const [item, setItem] = useState(initialItem);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function syncProgress() {
      if (!isSignedIn || !item?.id) return;
      const previousEpisode = item.currentEpisode ?? 0;
      if (episodeNumber <= previousEpisode) return;

      setIsPending(true);
      setError("");

      try {
        const response = await fetch(`/api/watchlist/${item.id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            currentEpisode: episodeNumber,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error || "Unable to sync progress.");
        }

        const payload = (await response.json()) as {
          item: PublicWatchlistItem | null;
        };

        if (!cancelled && payload.item) {
          setItem(payload.item);
          setInfo(`Progress synced to episode ${episodeNumber}.`);
        }
      } catch (syncError) {
        if (!cancelled) {
          setError(
            syncError instanceof Error
              ? syncError.message
              : "Unable to sync progress.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsPending(false);
        }
      }
    }

    void syncProgress();

    return () => {
      cancelled = true;
    };
  }, [episodeNumber, isSignedIn, item]);

  async function addTracking() {
    setIsPending(true);
    setError("");
    setInfo("");

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          animeId,
          status: "watching",
          currentEpisode: episodeNumber,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Unable to start tracking progress.");
      }

      const payload = (await response.json()) as {
        item: PublicWatchlistItem | null;
      };

      setItem(payload.item);
      setInfo(`Progress tracking started at episode ${episodeNumber}.`);
    } catch (trackingError) {
      setError(
        trackingError instanceof Error
          ? trackingError.message
          : "Unable to start tracking progress.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="panel watch-copy-panel">
      <div className="eyebrow">Progress</div>
      <h2 style={{ marginTop: 0 }}>Episode tracking</h2>
      {!isSignedIn ? (
        <>
          <p className="muted auth-copy">
            Sign in to track your episode progress and keep this series in your
            personal watchlist.
          </p>
          <div className="hero-actions">
            <Link href="/login" className="button primary">
              Sign In
            </Link>
            <Link href="/signup" className="button">
              Create Account
            </Link>
          </div>
        </>
      ) : item ? (
        <>
          <p className="muted auth-copy">
            Current tracked episode:{" "}
            <strong>{item.currentEpisode ?? 0}</strong>
            {item.status ? ` • ${item.status.replaceAll("_", " ")}` : ""}
          </p>
          <div className="hero-actions">
            <Link href="/watchlist" className="button">
              Open watchlist
            </Link>
            <button
              type="button"
              className="button primary"
              disabled={isPending}
              onClick={() => void addTracking()}
            >
              {isPending ? "Syncing..." : `Sync episode ${episodeNumber}`}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted auth-copy">
            This anime is not in your watchlist yet. Add it now and start
            tracking from episode {episodeNumber}.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="button primary"
              disabled={isPending}
              onClick={() => void addTracking()}
            >
              {isPending ? "Saving..." : "Track this episode"}
            </button>
            <Link href="/watchlist" className="button">
              Open watchlist
            </Link>
          </div>
        </>
      )}

      {info ? <p className="watch-sync-note success">{info}</p> : null}
      {error ? <p className="watch-sync-note error">{error}</p> : null}
    </div>
  );
}
