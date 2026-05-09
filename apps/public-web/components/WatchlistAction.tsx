"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import type { PublicWatchlistItem } from "../lib/api";

type WatchlistActionProps = {
  animeId: number;
  initialItem: PublicWatchlistItem | null;
  isSignedIn: boolean;
};

export function WatchlistAction({
  animeId,
  initialItem,
  isSignedIn,
}: WatchlistActionProps) {
  const [item, setItem] = useState(initialItem);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function addToWatchlist() {
    setIsPending(true);
    setError("");

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
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Unable to add this anime right now.");
      }

      const payload = (await response.json()) as { item: PublicWatchlistItem | null };
      startTransition(() => {
        setItem(payload.item ?? null);
      });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to add this anime right now.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function updateStatus(status: PublicWatchlistItem["status"]) {
    if (!item?.id) return;
    setIsPending(true);
    setError("");

    try {
      const response = await fetch(`/api/watchlist/${item.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Unable to update your watchlist.");
      }

      const payload = (await response.json()) as { item: PublicWatchlistItem | null };
      startTransition(() => {
        setItem(payload.item ?? item);
      });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to update your watchlist.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function removeFromWatchlist() {
    if (!item?.id) return;
    setIsPending(true);
    setError("");

    try {
      const response = await fetch(`/api/watchlist/${item.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Unable to remove this anime right now.");
      }

      startTransition(() => {
        setItem(null);
      });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to remove this anime right now.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="panel watchlist-action-panel" style={{ borderRadius: 28, padding: 24, marginTop: 28 }}>
      <div className="eyebrow">Personal Library</div>
      <h2 style={{ marginTop: 0 }}>Watchlist controls</h2>
      <p className="muted auth-copy">
        This anime detail page now talks to the same-origin Next bridge for personal actions.
      </p>

      {!isSignedIn ? (
        <div className="hero-actions">
          <Link href="/login" className="button primary">
            Sign in to save this anime
          </Link>
          <Link href="/signup" className="button">
            Create account
          </Link>
        </div>
      ) : item ? (
        <>
          <div className="watchlist-controls">
            <label className="watchlist-field">
              <span>Status</span>
              <select
                value={item.status || "watching"}
                disabled={isPending}
                onChange={(event) =>
                  void updateStatus(event.target.value as PublicWatchlistItem["status"])
                }
              >
                <option value="watching">Watching</option>
                <option value="completed">Completed</option>
                <option value="plan_to_watch">Plan to Watch</option>
                <option value="dropped">Dropped</option>
              </select>
            </label>
          </div>
          <div className="hero-actions" style={{ marginTop: 16 }}>
            <Link href="/watchlist" className="button primary">
              Open watchlist
            </Link>
            <button
              type="button"
              className="button danger"
              disabled={isPending}
              onClick={() => void removeFromWatchlist()}
            >
              {isPending ? "Removing..." : "Remove from watchlist"}
            </button>
          </div>
        </>
      ) : (
        <div className="hero-actions">
          <button
            type="button"
            className="button primary"
            disabled={isPending}
            onClick={() => void addToWatchlist()}
          >
            {isPending ? "Saving..." : "Add to watchlist"}
          </button>
          <Link href="/watchlist" className="button">
            Open watchlist
          </Link>
        </div>
      )}

      {error ? <div className="auth-error" style={{ marginTop: 14 }}>{error}</div> : null}
    </div>
  );
}
