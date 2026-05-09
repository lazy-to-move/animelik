"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";
import type { PublicWatchlistItem } from "../lib/api";
import { AnimeImage } from "./AnimeImage";

type WatchlistShelfProps = {
  initialItems: PublicWatchlistItem[];
};

const statusLabels: Record<string, string> = {
  watching: "Watching",
  completed: "Completed",
  plan_to_watch: "Plan to Watch",
  dropped: "Dropped",
};

function clampProgress(
  currentEpisode: number | null,
  totalEpisodes: number | null,
) {
  const current = Math.max(0, currentEpisode ?? 0);
  const total = Math.max(0, totalEpisodes ?? 0);
  if (!total) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

function normalizeSlug(slug?: string | null) {
  return (slug ?? "").replace(/^\/+|\/+$/g, "");
}

export function WatchlistShelf({ initialItems }: WatchlistShelfProps) {
  const [items, setItems] = useState(initialItems);
  const [episodeDrafts, setEpisodeDrafts] = useState<Record<number, string>>(
    Object.fromEntries(
      initialItems.map((item) => [item.id, String(item.currentEpisode ?? 0)]),
    ),
  );
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const hasItems = items.length > 0;
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          new Date(String(right.createdAt)).getTime() -
          new Date(String(left.createdAt)).getTime(),
      ),
    [items],
  );

  async function patchItem(
    itemId: number,
    payload: Partial<Pick<PublicWatchlistItem, "status" | "currentEpisode">>,
  ) {
    setPendingItemId(itemId);
    setError("");

    try {
      const response = await fetch(`/api/watchlist/${itemId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "Unable to update this watchlist item.");
      }

      const data = (await response.json()) as { item: PublicWatchlistItem | null };
      const updatedItem = data.item;
      if (updatedItem) {
        startTransition(() => {
          setItems((current) =>
            current.map((item) => (item.id === itemId ? updatedItem : item)),
          );
          setEpisodeDrafts((current) => ({
            ...current,
            [itemId]: String(updatedItem.currentEpisode ?? 0),
          }));
        });
      }
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to update this watchlist item.",
      );
    } finally {
      setPendingItemId(null);
    }
  }

  async function removeItem(itemId: number) {
    setPendingItemId(itemId);
    setError("");

    try {
      const response = await fetch(`/api/watchlist/${itemId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "Unable to remove this watchlist item.");
      }

      startTransition(() => {
        setItems((current) => current.filter((item) => item.id !== itemId));
        setEpisodeDrafts((current) => {
          const next = { ...current };
          delete next[itemId];
          return next;
        });
      });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to remove this watchlist item.",
      );
    } finally {
      setPendingItemId(null);
    }
  }

  if (!hasItems) {
    return (
      <div className="panel watch-copy-panel">
        <h2 style={{ marginTop: 0 }}>Your watchlist is empty</h2>
        <p className="muted">
          Save anime from the migration frontend and they will appear here
          immediately through the new same-origin API bridge.
        </p>
      </div>
    );
  }

  return (
    <div className="watchlist-shelf">
      {error ? <div className="auth-error">{error}</div> : null}
      <div className="grid anime-grid">
        {sortedItems.map((item) => {
          const slug = normalizeSlug(item.animeSlug);
          const progress = clampProgress(
            item.currentEpisode,
            item.animeEpisodesCount,
          );
          const nextEpisode = Math.max(1, (item.currentEpisode ?? 0) + 1);
          const isPending = pendingItemId === item.id;

          return (
            <article key={item.id} className="card">
              <AnimeImage
                src={item.animeCover}
                alt={item.animeTitle || "Anime cover"}
                sizes="(min-width: 1180px) 220px, (min-width: 768px) 33vw, 100vw"
                frameClassName="poster-media"
              />
              <div className="card-copy watchlist-card-copy">
                <div className="detail-meta" style={{ marginBottom: 12 }}>
                  <span className="pill">
                    {statusLabels[item.status || "watching"] || "Watching"}
                  </span>
                </div>
                <h3>{item.animeTitle || "Untitled anime"}</h3>
                {item.animeTitleEnglish &&
                item.animeTitleEnglish !== item.animeTitle ? (
                  <p className="watch-subtitle">{item.animeTitleEnglish}</p>
                ) : null}
                <p className="muted" style={{ marginTop: 10 }}>
                  {item.genreNames || item.categoryName || "No genre"}
                </p>

                <div className="watchlist-progress">
                  <div className="row">
                    <span className="muted">Progress</span>
                    <span className="muted">
                      {item.currentEpisode || 0} / {item.animeEpisodesCount || "?"}
                    </span>
                  </div>
                  <div className="watchlist-progress-bar">
                    <div
                      className="watchlist-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="watchlist-controls">
                  <label className="watchlist-field">
                    <span>Status</span>
                    <select
                      value={item.status || "watching"}
                      disabled={isPending}
                      onChange={(event) =>
                        void patchItem(item.id, {
                          status: event.target.value as PublicWatchlistItem["status"],
                        })
                      }
                    >
                      <option value="watching">Watching</option>
                      <option value="completed">Completed</option>
                      <option value="plan_to_watch">Plan to Watch</option>
                      <option value="dropped">Dropped</option>
                    </select>
                  </label>

                  <div className="watchlist-inline-form">
                    <label className="watchlist-field">
                      <span>Current episode</span>
                      <input
                        type="number"
                        min={0}
                        max={item.animeEpisodesCount || undefined}
                        value={episodeDrafts[item.id] ?? "0"}
                        disabled={isPending}
                        onChange={(event) =>
                          setEpisodeDrafts((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="button"
                      disabled={isPending}
                      onClick={() => {
                        const rawValue = episodeDrafts[item.id] ?? "0";
                        const parsed = Number.parseInt(rawValue, 10);
                        const currentEpisode = Number.isFinite(parsed)
                          ? Math.max(0, parsed)
                          : 0;
                        void patchItem(item.id, { currentEpisode });
                      }}
                    >
                      {isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                <div className="hero-actions" style={{ marginTop: 16 }}>
                  {slug ? (
                    <>
                      <Link href={`/anime/${slug}`} className="button">
                        Details
                      </Link>
                      <Link
                        href={`/watch/${slug}/${nextEpisode}`}
                        className="button primary"
                      >
                        Continue
                      </Link>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="button danger"
                    disabled={isPending}
                    onClick={() => void removeItem(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
