"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ScraperSourceOption = {
  id: string;
  name: string;
  baseUrl: string;
  animePathHint: string;
};

type ExecutionDetails = {
  mode: "inline" | "queue";
  backend: "db" | "bullmq";
  queued: boolean;
  message: string;
};

type ScraperAnimeListItem = {
  slug: string;
  title: string;
  coverImage?: string | null;
};

type AdminAnimeQuickActionItem = {
  id: number;
  title: string;
  slug: string;
  sourceSite?: string | null;
  externalSlug?: string | null;
};

type AdminScraperToolsProps = {
  sources: ScraperSourceOption[];
  execution: ExecutionDetails;
  recentAnime: AdminAnimeQuickActionItem[];
};

type LatestOrSearchResponse = {
  success: boolean;
  data?: ScraperAnimeListItem[];
  error?: string;
};

type AdminMutationResponse = {
  success: boolean;
  error?: string;
  message?: string;
  jobId?: number;
  queued?: boolean;
};

function buildSuccessMessage(payload: AdminMutationResponse, fallback: string) {
  if (payload.message) return payload.message;
  if (payload.queued && payload.jobId) {
    return `${fallback} Job #${payload.jobId} queued.`;
  }
  return fallback;
}

export function AdminScraperTools({
  sources,
  execution,
  recentAnime,
}: AdminScraperToolsProps) {
  const router = useRouter();
  const [source, setSource] = useState<string>(sources[0]?.id ?? "witanime");
  const [slug, setSlug] = useState("");
  const [importEpisodes, setImportEpisodes] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [latestItems, setLatestItems] = useState<ScraperAnimeListItem[]>([]);
  const [searchResults, setSearchResults] = useState<ScraperAnimeListItem[]>([]);
  const [isLoadingLatest, setIsLoadingLatest] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRunningProbe, setIsRunningProbe] = useState(false);
  const [pendingAnimeAction, setPendingAnimeAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadLatest(source);
  }, [source]);

  async function loadLatest(nextSource: string) {
    setIsLoadingLatest(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/scraper/latest?source=${encodeURIComponent(nextSource)}&limit=12`,
        {
          credentials: "same-origin",
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => null)) as LatestOrSearchResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to load the latest titles right now.");
      }

      startTransition(() => {
        setLatestItems(payload.data ?? []);
      });
    } catch (latestError) {
      setError(
        latestError instanceof Error
          ? latestError.message
          : "Unable to load the latest titles right now.",
      );
    } finally {
      setIsLoadingLatest(false);
    }
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/scraper/search?source=${encodeURIComponent(source)}&query=${encodeURIComponent(searchQuery.trim())}`,
        {
          credentials: "same-origin",
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => null)) as LatestOrSearchResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to search that source right now.");
      }

      startTransition(() => {
        setSearchResults(payload.data ?? []);
      });
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Unable to search that source right now.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slug.trim()) {
      setError("Enter a source slug before importing.");
      return;
    }

    setIsImporting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/scraper/import", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          source,
          slug: slug.trim(),
          importEpisodes,
        }),
      });

      const payload = (await response.json().catch(() => null)) as AdminMutationResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to queue that import right now.");
      }

      setMessage(buildSuccessMessage(payload, "Import started."));
      router.refresh();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to queue that import right now.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleQueueProbe() {
    setIsRunningProbe(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/scraper/queue-probe", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => null)) as AdminMutationResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to run the queue probe right now.");
      }

      setMessage(buildSuccessMessage(payload, "Queue probe started."));
      router.refresh();
    } catch (probeError) {
      setError(
        probeError instanceof Error
          ? probeError.message
          : "Unable to run the queue probe right now.",
      );
    } finally {
      setIsRunningProbe(false);
    }
  }

  async function runAnimeAction(
    animeId: number,
    action: "sync-all" | "refresh-metadata",
  ) {
    const pendingKey = `${action}:${animeId}`;
    setPendingAnimeAction(pendingKey);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/scraper/anime/${animeId}/${action}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => null)) as AdminMutationResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to run that anime action right now.");
      }

      setMessage(
        action === "sync-all"
          ? buildSuccessMessage(payload, "Episode sync started.")
          : buildSuccessMessage(payload, "Metadata refresh started."),
      );
      router.refresh();
    } catch (animeActionError) {
      setError(
        animeActionError instanceof Error
          ? animeActionError.message
          : "Unable to run that anime action right now.",
      );
    } finally {
      setPendingAnimeAction(null);
    }
  }

  const visibleSourceItems =
    searchResults.length > 0 || searchQuery.trim()
      ? searchResults
      : latestItems;

  return (
    <section className="panel watch-copy-panel">
      <div className="watch-heading-row">
        <div>
          <div className="eyebrow">Admin Scraper Tools</div>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Worker-backed source controls</h2>
          <p className="muted auth-copy" style={{ margin: 0 }}>
            This is the first real action-oriented admin slice in Next.js. It reuses the same
            queue/import logic as the legacy admin instead of proxying through the old UI.
          </p>
        </div>
        <span className="pill">
          {execution.queued ? `${execution.mode} • ${execution.backend}` : execution.mode}
        </span>
      </div>

      <div className="admin-tool-notice">
        <strong>Execution mode</strong>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {execution.message}
        </p>
      </div>

      <div className="admin-tool-grid">
        <div className="admin-tool-card">
          <h3>Import from source</h3>
          <p className="muted">
            Queue or run an anime import directly from one of the configured scraper providers.
          </p>
          <form className="admin-inline-form" onSubmit={handleImport}>
            <label className="watchlist-field">
              <span>Source site</span>
              <select value={source} onChange={(event) => setSource(event.target.value)}>
                {sources.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="watchlist-field">
              <span>Anime slug</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="tongari-boushi-no-atelier"
              />
            </label>
            <label className="admin-checkbox-row">
              <input
                type="checkbox"
                checked={importEpisodes}
                onChange={(event) => setImportEpisodes(event.target.checked)}
              />
              <span>Import episode list too</span>
            </label>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <button type="submit" className="button primary" disabled={isImporting}>
                {isImporting ? "Submitting..." : "Import"}
              </button>
              <button
                type="button"
                className="button"
                disabled={isRunningProbe}
                onClick={() => void handleQueueProbe()}
              >
                {isRunningProbe ? "Running..." : "Run Queue Probe"}
              </button>
            </div>
          </form>
        </div>

        <div className="admin-tool-card">
          <h3>Find source titles</h3>
          <p className="muted">
            Browse fresh titles from the selected source or search it before importing.
          </p>
          <form className="admin-inline-form" onSubmit={handleSearch}>
            <label className="watchlist-field">
              <span>Search source</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="SpongeBob"
              />
            </label>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <button type="submit" className="button primary" disabled={isSearching}>
                {isSearching ? "Searching..." : "Search"}
              </button>
              <button
                type="button"
                className="button"
                disabled={isLoadingLatest}
                onClick={() => void loadLatest(source)}
              >
                {isLoadingLatest ? "Refreshing..." : "Fetch latest"}
              </button>
            </div>
          </form>
          <div className="admin-source-list">
            {visibleSourceItems.map((item) => (
              <button
                key={`${item.slug}-${item.title}`}
                type="button"
                className="admin-source-item"
                onClick={() => setSlug(item.slug)}
              >
                <strong>{item.title}</strong>
                <span className="muted">{item.slug}</span>
              </button>
            ))}
            {!isLoadingLatest && !isSearching && visibleSourceItems.length === 0 ? (
              <div className="admin-list-empty muted">No source titles loaded yet.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="admin-tool-card" style={{ marginTop: 24 }}>
        <div className="row" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Quick anime actions</h3>
          <span className="muted">{recentAnime.length} recent titles</span>
        </div>
        <div className="admin-quick-action-grid">
          {recentAnime.map((item) => {
            const syncKey = `sync-all:${item.id}`;
            const refreshKey = `refresh-metadata:${item.id}`;

            return (
              <article key={item.id} className="admin-list-item">
                <div className="admin-list-row">
                  <strong>{item.title}</strong>
                  <span className="pill">{item.sourceSite || "source unknown"}</span>
                </div>
                <div className="admin-list-meta muted">
                  /{item.slug}
                  {item.externalSlug ? ` • external: ${item.externalSlug}` : ""}
                </div>
                <div className="hero-actions" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="button primary"
                    disabled={pendingAnimeAction === syncKey}
                    onClick={() => void runAnimeAction(item.id, "sync-all")}
                  >
                    {pendingAnimeAction === syncKey ? "Queueing..." : "Sync episodes"}
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={pendingAnimeAction === refreshKey}
                    onClick={() => void runAnimeAction(item.id, "refresh-metadata")}
                  >
                    {pendingAnimeAction === refreshKey
                      ? "Queueing..."
                      : "Refresh metadata"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {message ? <p className="watch-sync-note success">{message}</p> : null}
      {error ? <p className="watch-sync-note error">{error}</p> : null}
    </section>
  );
}
