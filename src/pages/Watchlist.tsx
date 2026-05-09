import { useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkX,
  CheckCircle2,
  Clock3,
  Play,
  Search,
  Sparkles,
  Trash2,
  Tv,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import AnimeArtwork from "@/components/AnimeArtwork";

const statusLabels: Record<string, string> = {
  watching: "Watching",
  completed: "Completed",
  plan_to_watch: "Plan to Watch",
  dropped: "Dropped",
};

const statusIcons = {
  watching: Clock3,
  completed: CheckCircle2,
  plan_to_watch: Sparkles,
  dropped: XCircle,
} as const;

type FilterKey = "all" | keyof typeof statusLabels;
type SortKey = "recent" | "progress" | "score" | "title";

function normalizeAnimeSlug(slug?: string | null) {
  return (slug ?? "").replace(/^\/+|\/+$/g, "");
}

function clampProgress(currentEpisode: number | null, totalEpisodes: number | null) {
  const current = Math.max(0, currentEpisode ?? 0);
  const total = Math.max(0, totalEpisodes ?? 0);
  if (!total) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

export default function Watchlist() {
  const { user, isLoading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [search, setSearch] = useState("");
  const [episodeDrafts, setEpisodeDrafts] = useState<Record<number, string>>({});

  const { data: watchlistItems, isLoading } = trpc.watchlist.list.useQuery(undefined, {
    enabled: !!user,
  });

  const utils = trpc.useUtils();
  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  });
  const updateMutation = trpc.watchlist.update.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  });

  const summary = useMemo(() => {
    const items = watchlistItems ?? [];
    const counts = {
      all: items.length,
      watching: items.filter((item) => item.status === "watching").length,
      completed: items.filter((item) => item.status === "completed").length,
      plan_to_watch: items.filter((item) => item.status === "plan_to_watch").length,
      dropped: items.filter((item) => item.status === "dropped").length,
    };

    const totalTracked = items.reduce((sum, item) => sum + (item.currentEpisode ?? 0), 0);
    const completionAverage = items.length
      ? Math.round(
          items.reduce((sum, item) => sum + clampProgress(item.currentEpisode, item.animeEpisodesCount), 0) / items.length,
        )
      : 0;

    return { counts, totalTracked, completionAverage };
  }, [watchlistItems]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const items = (watchlistItems ?? []).filter((item) => {
      const statusMatch = statusFilter === "all" || item.status === statusFilter;
      const searchMatch = !normalizedSearch || [
        item.animeTitle,
        item.animeTitleEnglish,
        item.animeTitleJp,
        item.genreNames,
        item.categoryName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));

      return statusMatch && searchMatch;
    });

    return items.sort((left, right) => {
      if (sortBy === "progress") {
        return clampProgress(right.currentEpisode, right.animeEpisodesCount) - clampProgress(left.currentEpisode, left.animeEpisodesCount);
      }

      if (sortBy === "score") {
        return Number(right.animeScore ?? 0) - Number(left.animeScore ?? 0);
      }

      if (sortBy === "title") {
        return String(left.animeTitle ?? "").localeCompare(String(right.animeTitle ?? ""));
      }

      return new Date(String(right.createdAt)).getTime() - new Date(String(left.createdAt)).getTime();
    });
  }, [watchlistItems, search, sortBy, statusFilter]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030209] pt-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#693def] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030209] px-4 pt-20">
        <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-10 text-center shadow-2xl">
          <BookmarkX className="mx-auto mb-5 h-14 w-14 text-[#888888]" />
          <p className="mb-2 text-2xl font-black text-white">Sign in to open your watchlist</p>
          <p className="mb-7 text-sm leading-relaxed text-[#888888]">
            Save anime, track your current episode, and keep your next watch ready.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[#693def] px-6 py-3 font-semibold text-white transition-all hover:bg-[#8257f2]"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030209] px-4 pb-16 pt-[150px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(105,61,239,0.18),transparent_35%),linear-gradient(180deg,rgba(18,14,31,0.96),rgba(8,7,14,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:p-8"
        >
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#693def]/25 bg-[#693def]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#9d7cff]">
                <BookmarkCheck className="h-4 w-4" />
                Personal Library
              </div>
              <h1 className="mb-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Watchlist
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-[#a6a1bb] sm:text-lg">
                Keep your anime organized, jump back into ongoing series fast, and manage what is next without digging through the whole site.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#66607d]">All</p>
                <p className="mt-2 text-2xl font-black text-white">{summary.counts.all}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#66607d]">Watching</p>
                <p className="mt-2 text-2xl font-black text-white">{summary.counts.watching}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#66607d]">Tracked EP</p>
                <p className="mt-2 text-2xl font-black text-white">{summary.totalTracked}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#66607d]">Avg Progress</p>
                <p className="mt-2 text-2xl font-black text-white">{summary.completionAverage}%</p>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6f6987]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your watchlist by anime title, english title, or genre..."
              aria-label="Search your watchlist"
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-4 text-white placeholder:text-[#59536b] focus:border-[#693def] focus:outline-none focus:ring-1 focus:ring-[#693def]"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="watchlist-sort" className="sr-only">
              Sort your watchlist
            </label>
            <select
              id="watchlist-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white focus:border-[#693def] focus:outline-none"
            >
              <option value="recent">Recently Added</option>
              <option value="progress">Highest Progress</option>
              <option value="score">Highest Score</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {([
            { key: "all", label: "All", count: summary.counts.all },
            { key: "watching", label: "Watching", count: summary.counts.watching },
            { key: "completed", label: "Completed", count: summary.counts.completed },
            { key: "plan_to_watch", label: "Plan to Watch", count: summary.counts.plan_to_watch },
            { key: "dropped", label: "Dropped", count: summary.counts.dropped },
          ] as Array<{ key: FilterKey; label: string; count: number }>).map((item) => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
                statusFilter === item.key
                  ? "border-[#693def] bg-[#693def] text-white shadow-[0_10px_25px_rgba(105,61,239,0.28)]"
                  : "border-white/10 bg-white/5 text-[#b5b0c7] hover:border-white/20 hover:bg-white/10"
              }`}
            >
              {item.label} <span className="ml-1 text-xs opacity-80">{item.count}</span>
            </button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-20 text-center">
            <Tv className="mx-auto mb-5 h-14 w-14 text-[#706a84]" />
            <p className="mb-2 text-2xl font-black text-white">
              {watchlistItems?.length ? "No anime match this view" : "Your watchlist is empty"}
            </p>
            <p className="mb-7 text-sm text-[#888888]">
              {watchlistItems?.length
                ? "Try another filter or search term."
                : "Start adding anime from Browse and your library will show up here."}
            </p>
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 rounded-full bg-[#693def] px-6 py-3 font-semibold text-white transition-all hover:bg-[#8257f2]"
            >
              Browse Anime
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredItems.map((item, index) => {
              const progress = clampProgress(item.currentEpisode, item.animeEpisodesCount);
              const nextEpisode = Math.min((item.currentEpisode ?? 0) + 1, item.animeEpisodesCount ?? (item.currentEpisode ?? 0) + 1);
              const StatusIcon = statusIcons[item.status || "watching"];
              const draftValue = episodeDrafts[item.id];
              const maxEpisodes = item.animeEpisodesCount && item.animeEpisodesCount > 0 ? item.animeEpisodesCount : 9999;
              const resolvedEpisode = Number.isFinite(Number(draftValue))
                ? Math.max(0, Math.min(maxEpisodes, Math.floor(Number(draftValue))))
                : Math.max(0, item.currentEpisode ?? 0);

              return (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: index * 0.04 }}
                  className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,17,32,0.98),rgba(11,10,18,0.98))] shadow-[0_14px_36px_rgba(0,0,0,0.28)]"
                >
                  <div className="grid grid-cols-[96px_1fr] gap-3 p-3 sm:grid-cols-[112px_1fr] sm:gap-4 sm:p-4">
                    <Link to={`/anime/${normalizeAnimeSlug(item.animeSlug)}`} className="block">
                      <div className="aspect-[2/3] overflow-hidden rounded-[1rem] border border-white/10 bg-[#14111d] shadow-lg">
                        <AnimeArtwork
                          src={item.animeCover}
                          alt={item.animeTitle || ""}
                          title={item.animeTitle}
                          className="h-full w-full"
                          imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          fallbackClassName="h-full w-full"
                        />
                      </div>
                    </Link>

                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to={`/anime/${normalizeAnimeSlug(item.animeSlug)}`}>
                            <h3 className="line-clamp-2 text-base font-black leading-tight text-white transition-colors group-hover:text-[#9d7cff] sm:text-lg">
                              {item.animeTitle}
                            </h3>
                          </Link>
                          {item.animeTitleEnglish && item.animeTitleEnglish !== item.animeTitle && (
                            <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#9d7cff] sm:text-sm">
                              {item.animeTitleEnglish}
                            </p>
                          )}
                          {item.animeTitleJp && (
                            <p className="mt-1 line-clamp-1 text-xs tracking-wide text-[#6f6987]">{item.animeTitleJp}</p>
                          )}
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#ddd8ee] sm:text-[11px]">
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusLabels[item.status || "watching"]}
                        </div>
                      </div>

                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a748f]">
                        <span>{item.animeType || "tv"}</span>
                        <span className="text-[#393347]">/</span>
                        <span>{item.animeReleaseYear || "Unknown Year"}</span>
                        <span className="text-[#393347]">/</span>
                        <span>{item.animeStatus || "upcoming"}</span>
                        {item.animeScore && (
                          <>
                            <span className="text-[#393347]">/</span>
                            <span className="text-yellow-400">{item.animeScore}</span>
                          </>
                        )}
                      </div>

                      <p className="mb-4 line-clamp-1 text-xs font-semibold text-[#a7a1bb] sm:text-sm">
                        {item.genreNames || item.categoryName || "Unknown genre"}
                      </p>

                      <div className="mb-3">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#b5b0c7] sm:text-sm">
                          <span>Progress</span>
                          <span>
                            {item.currentEpisode || 0} / {item.animeEpisodesCount || "?"}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#693def,#9b7dff)] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a748f]">
                            Episode
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={item.animeEpisodesCount || undefined}
                            inputMode="numeric"
                            aria-label={`Progress episode for ${item.animeTitle}`}
                            value={draftValue ?? String(item.currentEpisode ?? 0)}
                            onChange={(event) =>
                              setEpisodeDrafts((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            className="w-20 bg-transparent text-sm font-black tabular-nums text-white outline-none"
                          />
                          <span className="text-[11px] font-semibold text-[#7a748f]">
                            / {item.animeEpisodesCount || "?"}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            updateMutation.mutate({
                              id: item.id,
                              currentEpisode: resolvedEpisode,
                            });
                            setEpisodeDrafts((current) => {
                              const next = { ...current };
                              delete next[item.id];
                              return next;
                            });
                          }}
                          disabled={updateMutation.isPending}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-25"
                        >
                          Save Progress
                        </button>
                      </div>

                      <div className="grid gap-2">
                        <Link
                          to={`/watch/${normalizeAnimeSlug(item.animeSlug)}/${Math.max(1, resolvedEpisode || nextEpisode)}`}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#693def] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8257f2]"
                        >
                          <Play className="h-4 w-4 fill-white" />
                          Continue Watching
                        </Link>

                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <select
                            aria-label={`Watch status for ${item.animeTitle}`}
                            value={item.status || "watching"}
                            onChange={(event) =>
                              updateMutation.mutate({
                                id: item.id,
                                status: event.target.value as "watching" | "completed" | "plan_to_watch" | "dropped",
                              })
                            }
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white focus:border-[#693def] focus:outline-none"
                          >
                            {Object.entries(statusLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => removeMutation.mutate({ id: item.id })}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300 transition hover:bg-rose-500/15"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
