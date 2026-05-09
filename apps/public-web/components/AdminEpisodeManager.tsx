"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AnimeOption = {
  id: number;
  title: string;
  slug: string;
  episodesCount: number | null;
};

type EpisodeItem = {
  id: number;
  animeId: number;
  animeTitle: string;
  animeSlug: string;
  seasonNumber: number | null;
  number: number;
  title: string | null;
  synopsis: string | null;
  videoUrl: string | null;
  duration: number | null;
  airDate: string | Date | null;
};

type AdminEpisodeManagerProps = {
  animeOptions: AnimeOption[];
  items: EpisodeItem[];
  selectedAnimeId: number | null;
};

type FormState = {
  animeId: string;
  seasonNumber: string;
  number: string;
  title: string;
  duration: string;
  airDate: string;
  videoUrl: string;
  synopsis: string;
};

function createEmptyForm(selectedAnimeId: number | null): FormState {
  return {
    animeId: selectedAnimeId ? String(selectedAnimeId) : "",
    seasonNumber: "",
    number: "",
    title: "",
    duration: "",
    airDate: "",
    videoUrl: "",
    synopsis: "",
  };
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "No date";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString();
}

function formatDuration(value: number | null | undefined) {
  if (!value) return "No duration";
  return `${value} min`;
}

export function AdminEpisodeManager({
  animeOptions,
  items,
  selectedAnimeId,
}: AdminEpisodeManagerProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [form, setForm] = useState<FormState>(() => createEmptyForm(selectedAnimeId));
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (editingId !== null) return;
    setForm((current) => ({
      ...current,
      animeId: current.animeId || (selectedAnimeId ? String(selectedAnimeId) : ""),
    }));
  }, [editingId, selectedAnimeId]);

  const selectedAnime = useMemo(
    () => animeOptions.find((option) => option.id === selectedAnimeId) ?? null,
    [animeOptions, selectedAnimeId],
  );
  const editingEpisode = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items],
  );
  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => visibleIds.includes(id)));
  }, [visibleIds]);

  function resetForm(nextAnimeId = selectedAnimeId) {
    setEditingId(null);
    setForm(createEmptyForm(nextAnimeId));
    setMessage(null);
  }

  function startEdit(item: EpisodeItem) {
    setEditingId(item.id);
    setForm({
      animeId: String(item.animeId),
      seasonNumber: item.seasonNumber ? String(item.seasonNumber) : "",
      number: String(item.number),
      title: item.title ?? "",
      duration: item.duration ? String(item.duration) : "",
      airDate: item.airDate
        ? new Date(item.airDate).toISOString().slice(0, 10)
        : "",
      videoUrl: item.videoUrl ?? "",
      synopsis: item.synopsis ?? "",
    });
    setMessage(null);
  }

  async function readJson(response: Response) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }
    return payload;
  }

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

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const actionKey = editingEpisode ? `save-${editingEpisode.id}` : "create-episode";
    await runAction(actionKey, async () => {
      const payload = {
        animeId: Number.parseInt(form.animeId, 10),
        seasonNumber: form.seasonNumber ? Number.parseInt(form.seasonNumber, 10) : undefined,
        number: Number.parseInt(form.number, 10),
        title: form.title,
        duration: form.duration ? Number.parseInt(form.duration, 10) : undefined,
        airDate: form.airDate || undefined,
        videoUrl: form.videoUrl || undefined,
        synopsis: form.synopsis || undefined,
      };
      const response = await fetch(
        editingEpisode ? `/api/admin/episodes/${editingEpisode.id}` : "/api/admin/episodes",
        {
          method: editingEpisode ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await readJson(response);
      const episodeLabel = form.title || `Episode ${form.number}`;
      const resultText = editingEpisode
        ? `${episodeLabel} was updated successfully.`
        : `${episodeLabel} was created successfully.`;
      resetForm(Number.parseInt(form.animeId, 10));
      return resultText;
    });
  }

  if (animeOptions.length === 0) {
    return (
      <div className="admin-list-empty muted">
        Import an anime before managing episodes from the Next admin surface.
      </div>
    );
  }

  return (
    <div className="admin-panels">
      <section className="panel watch-copy-panel">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{editingEpisode ? "Edit episode" : "Create episode"}</h2>
          {editingEpisode ? (
            <button type="button" className="button compact" onClick={() => resetForm()}>
              Cancel
            </button>
          ) : (
            <div className="muted">
              {selectedAnime ? `${selectedAnime.title} | ${selectedAnime.episodesCount ?? 0} episodes` : "Choose an anime"}
            </div>
          )}
        </div>
        {message ? <div className={`watch-sync-note ${message.tone}`}>{message.text}</div> : null}
        <form className="admin-inline-form" onSubmit={submitForm}>
          <label className="watchlist-field">
            <span>Anime</span>
            <select
              aria-label="Episode anime"
              value={form.animeId}
              onChange={(event) => setForm({ ...form, animeId: event.target.value })}
              required
            >
              <option value="">Choose an anime</option>
              {animeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-grid">
            <label className="watchlist-field">
              <span>Episode number</span>
              <input
                aria-label="Episode number"
                type="number"
                min="1"
                value={form.number}
                onChange={(event) => setForm({ ...form, number: event.target.value })}
                required
              />
            </label>
            <label className="watchlist-field">
              <span>Season number</span>
              <input
                aria-label="Season number"
                type="number"
                min="1"
                value={form.seasonNumber}
                onChange={(event) => setForm({ ...form, seasonNumber: event.target.value })}
              />
            </label>
            <label className="watchlist-field">
              <span>Duration (minutes)</span>
              <input
                aria-label="Episode duration"
                type="number"
                min="1"
                value={form.duration}
                onChange={(event) => setForm({ ...form, duration: event.target.value })}
              />
            </label>
            <label className="watchlist-field">
              <span>Air date</span>
              <input
                aria-label="Episode air date"
                type="date"
                value={form.airDate}
                onChange={(event) => setForm({ ...form, airDate: event.target.value })}
              />
            </label>
          </div>
          <label className="watchlist-field">
            <span>Title</span>
            <input
              aria-label="Episode title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Episode title"
            />
          </label>
          <label className="watchlist-field">
            <span>Video URL</span>
            <input
              aria-label="Episode video URL"
              value={form.videoUrl}
              onChange={(event) => setForm({ ...form, videoUrl: event.target.value })}
              placeholder="https://..."
            />
          </label>
          <label className="watchlist-field">
            <span>Synopsis</span>
            <textarea
              aria-label="Episode synopsis"
              value={form.synopsis}
              onChange={(event) => setForm({ ...form, synopsis: event.target.value })}
              placeholder="Optional synopsis"
            />
          </label>
          <button type="submit" className="button primary" disabled={busyKey !== null}>
            {busyKey === (editingEpisode ? `save-${editingEpisode.id}` : "create-episode")
              ? editingEpisode
                ? "Saving..."
                : "Creating..."
              : editingEpisode
                ? "Save episode"
                : "Create episode"}
          </button>
        </form>
      </section>

      <section className="panel watch-copy-panel">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Episodes</h2>
          <span className="muted">{items.length} visible</span>
        </div>
        <div className="admin-action-row" style={{ marginTop: 0, marginBottom: 16 }}>
          <label className="admin-checkbox-row">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
            <span>Select all visible</span>
          </label>
          <span className="muted">{selectedIds.length} selected</span>
          <button
            type="button"
            className="button compact danger"
            disabled={selectedIds.length === 0 || busyKey !== null}
            onClick={() => {
              if (!window.confirm(`Delete ${selectedIds.length} selected episode record(s)?`)) return;
              void runAction("bulk-delete-episodes", async () => {
                const response = await fetch("/api/admin/episodes/bulk-delete", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ ids: selectedIds }),
                });
                await readJson(response);
                setSelectedIds([]);
                if (editingId && selectedIds.includes(editingId)) {
                  resetForm(selectedAnimeId);
                }
                return `${selectedIds.length} episode record(s) were deleted successfully.`;
              });
            }}
          >
            {busyKey === "bulk-delete-episodes" ? "Deleting..." : "Delete selected"}
          </button>
        </div>
        <div className="admin-list">
          {items.length === 0 ? (
            <div className="admin-list-empty muted">
              No episodes matched this filter for {selectedAnime?.title ?? "the selected anime"}.
            </div>
          ) : (
            items.map((item) => {
              const deleteKey = `delete-episode-${item.id}`;
              const episodeLabel = item.title || `Episode ${item.number}`;
              return (
                <article key={item.id} className="admin-list-item">
                  <div className="admin-list-row">
                    <div
                      className="row"
                      style={{ alignItems: "flex-start", justifyContent: "flex-start", gap: 12 }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        aria-label={`Select episode ${item.number}`}
                        style={{ marginTop: 4 }}
                      />
                      <strong>
                        {item.seasonNumber ? `S${item.seasonNumber} ` : ""}
                        Episode {item.number}
                        {item.title ? ` | ${item.title}` : ""}
                      </strong>
                    </div>
                    <span className="pill">{formatDuration(item.duration)}</span>
                  </div>
                  <div className="admin-list-meta muted">
                    {item.animeTitle} | Air date: {formatDate(item.airDate)}
                  </div>
                  {item.synopsis ? <div className="admin-list-meta muted">{item.synopsis}</div> : null}
                  <div className="admin-action-row">
                    <Link href={`/watch/${item.animeSlug}/${item.number}`} className="button compact">
                      Open watch page
                    </Link>
                    <button
                      type="button"
                      className="button compact"
                      onClick={() => startEdit(item)}
                    >
                      Edit episode
                    </button>
                    <button
                      type="button"
                      className="button compact danger"
                      disabled={busyKey !== null}
                      onClick={() => {
                        if (!window.confirm(`Delete ${episodeLabel}?`)) return;
                        void runAction(deleteKey, async () => {
                          const response = await fetch(`/api/admin/episodes/${item.id}`, {
                            method: "DELETE",
                            credentials: "same-origin",
                          });
                          await readJson(response);
                          if (editingId === item.id) {
                            resetForm(item.animeId);
                          }
                          return `${episodeLabel} was deleted successfully.`;
                        });
                      }}
                    >
                      {busyKey === deleteKey ? "Deleting..." : "Delete episode"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
