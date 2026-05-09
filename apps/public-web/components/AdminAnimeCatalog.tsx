"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AdminAnimeItem = {
  id: number;
  title: string;
  titleEnglish: string | null;
  slug: string;
  status: string | null;
  type: string | null;
  sourceSite: string | null;
  externalSlug: string | null;
  episodesCount: number | null;
  score: string | null;
  metadataSource: string | null;
  lastScrapedAt: string | Date | null;
  createdAt: string | Date;
};

type AdminAnimeCatalogProps = {
  items: AdminAnimeItem[];
  sources: Array<{ id: string; name: string }>;
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Never";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export function AdminAnimeCatalog({ items, sources }: AdminAnimeCatalogProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );

  const sourceLabelMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source.name] as const)),
    [sources],
  );
  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => visibleIds.includes(id)));
  }, [visibleIds]);

  async function runAction(actionKey: string, task: () => Promise<string>) {
    setBusyKey(actionKey);
    setMessage(null);
    try {
      const result = await task();
      setMessage({ tone: "success", text: result });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function readJson(response: Response) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      success?: boolean;
      queued?: boolean;
      syncedCount?: number;
    };

    if (!response.ok) {
      throw new Error(payload.error || payload.message || "Request failed.");
    }

    return payload;
  }

  function toggleSelection(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleAllVisible() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  if (items.length === 0) {
    return (
      <div className="admin-list-empty muted">
        No anime matched this catalog filter yet.
      </div>
    );
  }

  return (
    <div className="admin-list">
      <div className="admin-action-row" style={{ marginTop: 0 }}>
        <label className="admin-checkbox-row">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
          />
          <span>Select all visible</span>
        </label>
        <span className="muted">{selectedIds.length} selected</span>
        <button
          type="button"
          className="button compact danger"
          disabled={selectedIds.length === 0 || busyKey !== null}
          onClick={() => {
            if (!window.confirm(`Delete ${selectedIds.length} selected anime record(s)?`)) return;
            void runAction("bulk-delete-anime", async () => {
              const response = await fetch("/api/admin/anime/bulk-delete", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ ids: selectedIds }),
              });
              await readJson(response);
              setSelectedIds([]);
              return `${selectedIds.length} anime record(s) were deleted successfully.`;
            });
          }}
        >
          {busyKey === "bulk-delete-anime" ? "Deleting..." : "Delete selected"}
        </button>
      </div>
      {message ? (
        <div className={`watch-sync-note ${message.tone}`}>
          {message.text}
        </div>
      ) : null}
      {items.map((item) => {
        const syncKey = `sync-${item.id}`;
        const refreshKey = `refresh-${item.id}`;
        const deleteKey = `delete-${item.id}`;
        return (
          <article key={item.id} className="admin-list-item">
            <div className="admin-list-row">
              <div className="row" style={{ alignItems: "flex-start", justifyContent: "flex-start", gap: 12 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelection(item.id)}
                  aria-label={`Select ${item.title}`}
                  style={{ marginTop: 4 }}
                />
                <div>
                <strong>{item.title}</strong>
                {item.titleEnglish ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    {item.titleEnglish}
                  </div>
                ) : null}
                </div>
              </div>
              <span className="pill">{item.status || "unknown"}</span>
            </div>
            <div className="admin-list-meta muted">
              /{item.slug}
              {" | "}
              {item.type || "unknown type"}
              {" | "}
              Episodes: {item.episodesCount ?? 0}
              {" | "}
              Source: {item.sourceSite ? sourceLabelMap.get(item.sourceSite) || item.sourceSite : "manual"}
            </div>
            <div className="admin-list-meta muted">
              Metadata: {item.metadataSource || "unknown"}
              {" | "}
              Last scraped: {formatDate(item.lastScrapedAt)}
              {" | "}
              Added: {formatDate(item.createdAt)}
            </div>
            {item.externalSlug ? (
              <div className="admin-list-meta muted">External slug: {item.externalSlug}</div>
            ) : null}
            <div className="admin-action-row">
              <Link href={`/anime/${item.slug}`} className="button compact">
                Open public page
              </Link>
              <button
                type="button"
                className="button compact"
                onClick={() =>
                  runAction(syncKey, async () => {
                    const response = await fetch(`/api/admin/scraper/anime/${item.id}/sync-all`, {
                      method: "POST",
                      credentials: "same-origin",
                    });
                    const payload = await readJson(response);
                    if (payload.queued) {
                      return "Episode sync job queued successfully.";
                    }
                    return `Episode sync completed${typeof payload.syncedCount === "number" ? ` (${payload.syncedCount} episodes)` : "."}`;
                  })
                }
                disabled={busyKey !== null}
              >
                {busyKey === syncKey ? "Syncing..." : "Sync episodes"}
              </button>
              <button
                type="button"
                className="button compact"
                onClick={() =>
                  runAction(refreshKey, async () => {
                    const response = await fetch(
                      `/api/admin/scraper/anime/${item.id}/refresh-metadata`,
                      {
                        method: "POST",
                        credentials: "same-origin",
                      },
                    );
                    const payload = await readJson(response);
                    if (payload.queued) {
                      return "Metadata refresh job queued successfully.";
                    }
                    return "Metadata refreshed successfully.";
                  })
                }
                disabled={busyKey !== null}
              >
                {busyKey === refreshKey ? "Refreshing..." : "Refresh metadata"}
              </button>
              <button
                type="button"
                className="button compact danger"
                onClick={() => {
                  if (!window.confirm(`Delete ${item.title} and all its episodes?`)) return;
                  void runAction(deleteKey, async () => {
                    const response = await fetch(`/api/admin/anime/${item.id}`, {
                      method: "DELETE",
                      credentials: "same-origin",
                    });
                    await readJson(response);
                    return `${item.title} was deleted successfully.`;
                  });
                }}
                disabled={busyKey !== null}
              >
                {busyKey === deleteKey ? "Deleting..." : "Delete anime"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
