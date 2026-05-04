import { useState } from "react";
import { useSearchParams } from "react-router";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { Search, Star, SlidersHorizontal, X, Play, Grid3X3, List } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AnimeArtwork from "@/components/AnimeArtwork";
import MixedSynopsisText from "@/components/MixedSynopsisText";

function normalizeAnimeSlug(slug?: string | null) {
  return (slug ?? "").replace(/^\/+|\/+$/g, "");
}

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "upcoming", label: "Upcoming" },
];

const typeOptions = [
  { value: "", label: "All Types" },
  { value: "tv", label: "TV Series" },
  { value: "movie", label: "Movie" },
  { value: "ova", label: "OVA" },
  { value: "special", label: "Special" },
];

const animeStatuses = new Set(["ongoing", "completed", "upcoming"]);

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const searchQuery = searchParams.get("search") || "";
  const categoryFilter = searchParams.get("category") || "";
  const statusFilter = searchParams.get("status") || "";
  const typeFilter = searchParams.get("type") || "";
  const yearFilter = searchParams.get("year") || "";
  const [page, setPage] = useState(1);

  const { data: categories } = trpc.category.list.useQuery();
  const { data: animeData, isLoading } = trpc.anime.list.useQuery({
    category: categoryFilter || undefined,
    status: animeStatuses.has(statusFilter)
      ? (statusFilter as "ongoing" | "completed" | "upcoming")
      : undefined,
    type: typeFilter
      ? (typeFilter as "tv" | "movie" | "ova" | "special")
      : undefined,
    releaseYear: yearFilter ? Number(yearFilter) : undefined,
    search: searchQuery || undefined,
    page,
    limit: 24,
  });

  const yearOptions = Array.from(
    new Set((animeData?.items ?? []).map((item) => item.releaseYear).filter((value): value is number => value !== null)),
  ).sort((a, b) => b - a);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setPage(1);
  };

  const hasFilters = searchQuery || categoryFilter || statusFilter || typeFilter || yearFilter;

  return (
    <div className="min-h-screen bg-[#030209] pt-[150px] pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight">Browse Anime</h1>
          <div className="flex items-center gap-3">
            <div className="h-1 w-12 bg-[#693def] rounded-full" />
            <p className="text-lg text-[#777777] font-medium">
              <span className="text-white font-bold">{animeData?.total ?? 0}</span> titles found
              {searchQuery && <span> for <span className="text-[#8257f2]">"{searchQuery}"</span></span>}
            </p>
          </div>
        </motion.div>

        {/* Search & Filters Bar */}
        <div className="mb-12 flex flex-col gap-4 xl:flex-row xl:items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="Search anime by title..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-[#555555] focus:outline-none focus:border-[#693def] focus:ring-1 focus:ring-[#693def] transition-all shadow-xl"
            />
          </div>
          <div className="flex gap-2 self-end xl:self-auto">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl border transition-all duration-300 shadow-lg ${
                filtersOpen || hasFilters
                  ? "border-[#693def] bg-[#693def]/10 text-[#693def]"
                  : "border-white/10 bg-white/5 text-[#cccccc] hover:bg-white/10 hover:border-white/20"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-sm font-bold">Filters</span>
              {hasFilters && (
                <span className="w-5 h-5 rounded-full bg-[#693def] text-white text-[10px] font-bold flex items-center justify-center">
                  {[categoryFilter, statusFilter, typeFilter, yearFilter].filter(Boolean).length}
                </span>
              )}
            </button>
            <div className="flex rounded-xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-3 transition-all ${viewMode === "grid" ? "bg-[#693def] text-white" : "bg-white/5 text-[#888888] hover:bg-white/10"}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-3 transition-all ${viewMode === "list" ? "bg-[#693def] text-white" : "bg-white/5 text-[#888888] hover:bg-white/10"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-[#888888] mb-2">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => updateFilter("category", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#693def]"
                >
                  <option value="">All Categories</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#888888] mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => updateFilter("status", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#693def]"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#888888] mb-2">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => updateFilter("type", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#693def]"
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#888888] mb-2">Year</label>
                <select
                  value={yearFilter}
                  onChange={(e) => updateFilter("year", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#693def]"
                >
                  <option value="">All Years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 flex items-center gap-1 text-sm text-[#693def] hover:text-[#8257f2] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear all filters
              </button>
            )}
          </motion.div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-[#693def] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : animeData?.items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-[#888888]">No anime found</p>
            <p className="text-sm text-[#888888] mt-2">Try adjusting your filters</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
            {animeData?.items.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Link to={`/anime/${normalizeAnimeSlug(a.slug)}`} className="group block">
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-4 shadow-xl border border-white/5 bg-white/[0.03]">
                    <AnimeArtwork
                      src={a.coverImage}
                      alt={a.title}
                      title={a.title}
                      className="w-full h-full"
                      imageClassName="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      fallbackClassName="w-full h-full transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 card-overlay opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
                      <div className="w-14 h-14 rounded-full bg-[#693def]/90 flex items-center justify-center backdrop-blur-md shadow-[0_0_20px_rgba(105,61,239,0.5)]">
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-[15px] font-bold text-white truncate group-hover:text-[#8257f2] transition-colors duration-300 px-0.5">
                    {a.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 px-0.5">
                    <span className="text-[11px] font-medium text-[#777777] uppercase tracking-wider">{a.genreNames || a.categoryName}</span>
                    <span className="text-[#333333]">/</span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-yellow-500">
                      <Star className="w-3 h-3 fill-yellow-500" />
                      {a.score}
                    </span>
                    {a.releaseYear && (
                      <>
                        <span className="text-[#333333]">/</span>
                        <span className="text-[11px] font-medium text-[#777777]">{a.releaseYear}</span>
                      </>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {animeData?.items.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Link to={`/anime/${normalizeAnimeSlug(a.slug)}`} className="group flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#693def]/30 transition-all">
                  <div className="relative w-28 sm:w-32 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.03]">
                    <AnimeArtwork
                      src={a.coverImage}
                      alt={a.title}
                      title={a.title}
                      className="w-full h-full"
                      imageClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      fallbackClassName="w-full h-full transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white group-hover:text-[#8257f2] transition-colors mb-1">
                      {a.title}
                    </h3>
                    {a.titleJp && <p className="text-sm text-[#8257f2] mb-2">{a.titleJp}</p>}
                    <MixedSynopsisText className="mb-3 line-clamp-2 text-sm text-[#888888]">
                      {a.synopsis}
                    </MixedSynopsisText>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-md bg-[#693def]/20 text-[#8257f2] text-xs font-medium">
                        {a.status}
                      </span>
                      <span className="text-xs text-[#888888]">{a.genreNames || a.categoryName}</span>
                      <span className="flex items-center gap-0.5 text-xs text-yellow-400">
                        <Star className="w-3 h-3 fill-yellow-400" />
                        {a.score}
                      </span>
                      <span className="text-xs text-[#888888]">{a.releaseYear}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {animeData && animeData.total > 24 && (
          <div className="flex justify-center gap-2 mt-12">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-all"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-[#888888]">
              Page {page} of {Math.ceil(animeData.total / 24)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 24 >= animeData.total}
              className="px-4 py-2 rounded-lg bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
