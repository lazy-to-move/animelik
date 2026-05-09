import { useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  Shield, Users, Tv, Film, MessageSquare, Plus, Pencil, Trash2,
  X, Star, TrendingUp, Activity, ChevronRight, Search, BarChart3,
  Layers, Save, Loader2, Download, RefreshCw, Globe, AlertCircle, Flag, type LucideIcon
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import AnimeArtwork from "@/components/AnimeArtwork";
import type { SourceSiteId } from "../../api/services/scraper/types";

type Tab = "overview" | "anime" | "episodes" | "categories" | "reports" | "scraper";

type SourceSiteOption = {
  id: string;
  name: string;
  baseUrl: string;
  animePathHint: string;
};

type AdminAnime = {
  id: number;
  title: string;
  titleJp?: string | null;
  slug: string;
  synopsis: string;
  coverImage?: string | null;
  bannerImage?: string | null;
  status?: "ongoing" | "completed" | "upcoming" | null;
  type?: "tv" | "movie" | "ova" | "special" | null;
  rating?: string | null;
  releaseYear?: number | null;
  studio?: string | null;
  score?: string | null;
  episodesCount?: number | null;
  duration?: number | null;
  featured?: boolean | null;
  categoryId?: number | null;
  genreNames?: string;
  categoryName?: string;
};

type AdminEpisode = {
  id: number;
  animeId: number;
  number: number;
  title?: string | null;
  synopsis?: string | null;
  thumbnail?: string | null;
  videoUrl?: string | null;
  duration?: number | null;
  airDate?: string | Date | null;
};

type AdminCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

type LatestSourceAnime = {
  slug: string;
  title: string;
  coverImage?: string | null;
};

function SourceSiteSelect({
  value,
  onChange,
  options,
}: {
  value: SourceSiteId;
  onChange: (value: SourceSiteId) => void;
  options?: SourceSiteOption[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SourceSiteId)}
      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm"
    >
      {(options ?? []).map((site) => (
        <option key={site.id} value={site.id} className="bg-[#0e0c14]">
          {site.name}
        </option>
      ))}
    </select>
  );
}

/* ─── Stat Card ─── */
function StatCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: LucideIcon; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <p className="text-sm text-[#888888]">{title}</p>
    </motion.div>
  );
}

/* ─── Anime Form Modal ─── */
function AnimeFormModal({ anime, onClose }: { anime?: AdminAnime; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<{
    title: string;
    titleJp: string;
    slug: string;
    synopsis: string;
    coverImage: string;
    bannerImage: string;
    status: NonNullable<AdminAnime["status"]>;
    type: NonNullable<AdminAnime["type"]>;
    rating: string;
    releaseYear: number;
    studio: string;
    categoryId: number;
    duration: number;
    featured: boolean;
    score: string;
    episodesCount: number;
  }>({
    title: anime?.title || "",
    titleJp: anime?.titleJp || "",
    slug: anime?.slug || "",
    synopsis: anime?.synopsis || "",
    coverImage: anime?.coverImage || "",
    bannerImage: anime?.bannerImage || "",
    status: anime?.status || "upcoming",
    type: anime?.type || "tv",
    rating: anime?.rating || "PG-13",
    releaseYear: anime?.releaseYear || new Date().getFullYear(),
    studio: anime?.studio || "",
    categoryId: anime?.categoryId || 1,
    duration: anime?.duration || 24,
    featured: anime?.featured || false,
    score: anime?.score || "0.00",
    episodesCount: anime?.episodesCount || 0,
  });

  const createAnime = trpc.anime.create.useMutation({
    onSuccess: () => {
      utils.anime.list.invalidate();
      utils.dashboard.stats.invalidate();
      onClose();
    },
  });
  const updateAnime = trpc.anime.update.useMutation({
    onSuccess: () => {
      utils.anime.list.invalidate();
      onClose();
    },
  });

  const { data: categories } = trpc.category.list.useQuery();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (anime) {
      updateAnime.mutate({ id: anime.id, ...form, score: String(form.score), releaseYear: Number(form.releaseYear), categoryId: Number(form.categoryId), duration: Number(form.duration), episodesCount: Number(form.episodesCount) });
    } else {
      createAnime.mutate({ ...form, releaseYear: Number(form.releaseYear), categoryId: Number(form.categoryId), duration: Number(form.duration) });
    }
  };

  const isPending = createAnime.isPending || updateAnime.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0e0c14] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto scroll-hide"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">{anime ? "Edit Anime" : "Add New Anime"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[#888888] hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#888888] mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Japanese Title</label>
              <input
                type="text"
                value={form.titleJp}
                onChange={(e) => setForm({ ...form, titleJp: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#888888] mb-1">Slug *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Studio</label>
              <input
                type="text"
                value={form.studio}
                onChange={(e) => setForm({ ...form, studio: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#888888] mb-1">Synopsis *</label>
            <textarea
              value={form.synopsis}
              onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
              required
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#693def] text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#888888] mb-1">Cover Image URL</label>
              <input
                type="text"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                placeholder="/anime-covers/example.jpg"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Banner Image URL</label>
              <input
                type="text"
                value={form.bannerImage}
                onChange={(e) => setForm({ ...form, bannerImage: e.target.value })}
                placeholder="/anime-banners/example.jpg"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-[#888888] mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as NonNullable<AdminAnime["status"]> })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              >
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as NonNullable<AdminAnime["type"]> })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              >
                <option value="tv">TV</option>
                <option value="movie">Movie</option>
                <option value="ova">OVA</option>
                <option value="special">Special</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Rating</label>
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              >
                <option value="G">G</option>
                <option value="PG">PG</option>
                <option value="PG-13">PG-13</option>
                <option value="PG-16">PG-16</option>
                <option value="R-17+">R-17+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Year</label>
              <input
                type="number"
                value={form.releaseYear}
                onChange={(e) => setForm({ ...form, releaseYear: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-[#888888] mb-1">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              >
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Duration (min)</label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Episodes</label>
              <input
                type="number"
                value={form.episodesCount}
                onChange={(e) => setForm({ ...form, episodesCount: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Score</label>
              <input
                type="text"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="featured"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              className="w-4 h-4 accent-[#693def]"
            />
            <label htmlFor="featured" className="text-sm text-[#cccccc]">Featured on homepage</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#693def] text-white text-sm hover:bg-[#8257f2] disabled:opacity-50 transition-all"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              {anime ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Episode Form Modal ─── */
function EpisodeFormModal({ animeId, episode, onClose }: { animeId: number; episode?: AdminEpisode; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    animeId,
    number: episode?.number || 1,
    title: episode?.title || "",
    synopsis: episode?.synopsis || "",
    thumbnail: episode?.thumbnail || "",
    videoUrl: episode?.videoUrl || "",
    duration: episode?.duration || 1440,
    airDate: episode?.airDate ? new Date(episode.airDate).toISOString().split("T")[0] : "",
  });

  const createEpisode = trpc.episode.create.useMutation({
    onSuccess: () => {
      utils.episode.list.invalidate({ animeId });
      utils.dashboard.stats.invalidate();
      onClose();
    },
  });
  const updateEpisode = trpc.episode.update.useMutation({
    onSuccess: () => {
      utils.episode.list.invalidate({ animeId });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (episode) {
      updateEpisode.mutate({ id: episode.id, ...form, number: Number(form.number), duration: Number(form.duration) });
    } else {
      createEpisode.mutate({ ...form, number: Number(form.number), duration: Number(form.duration) });
    }
  };

  const isPending = createEpisode.isPending || updateEpisode.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0e0c14] border border-white/10 rounded-2xl w-full max-w-lg"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">{episode ? "Edit Episode" : "Add Episode"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[#888888] hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#888888] mb-1">Episode Number *</label>
              <input
                type="number"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
                required
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Duration (seconds)</label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#888888] mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm text-[#888888] mb-1">Synopsis</label>
            <textarea
              value={form.synopsis}
              onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#693def] text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#888888] mb-1">Thumbnail URL</label>
              <input
                type="text"
                value={form.thumbnail}
                onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-[#888888] mb-1">Video URL</label>
              <input
                type="text"
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#888888] mb-1">Air Date</label>
            <input
              type="date"
              value={form.airDate}
              onChange={(e) => setForm({ ...form, airDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#693def] text-white text-sm hover:bg-[#8257f2] disabled:opacity-50 transition-all"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              {episode ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Category Form Modal ─── */
function CategoryFormModal({ category, onClose }: { category?: AdminCategory; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: category?.name || "",
    slug: category?.slug || "",
    description: category?.description || "",
  });

  const createCategory = trpc.category.create.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      onClose();
    },
  });
  const updateCategory = trpc.category.update.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (category) {
      updateCategory.mutate({ id: category.id, ...form });
    } else {
      createCategory.mutate(form);
    }
  };

  const isPending = createCategory.isPending || updateCategory.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0e0c14] border border-white/10 rounded-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">{category ? "Edit Category" : "Add Category"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[#888888] hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-[#888888] mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm text-[#888888] mb-1">Slug *</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm text-[#888888] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#693def] text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#693def] text-white text-sm hover:bg-[#8257f2] disabled:opacity-50 transition-all"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              {category ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Import Anime Form ─── */
function ImportAnimeForm() {
  const [source, setSource] = useState<SourceSiteId>("witanime");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const utils = trpc.useUtils();
  const { data: sources } = trpc.scraper.getSources.useQuery();
  const selectedSource = sources?.find((site) => site.id === source);

  const importMutation = trpc.scraper.importFromSource.useMutation({
    onSuccess: (data) => {
      setLoading(false);
      if ("queued" in data && data.queued) {
        setResult({
          success: true,
          message: `${data.message} Job #${data.jobId} is now waiting for the worker.`,
        });
        void utils.scraper.listScrapeJobs.invalidate();
        return;
      }
      if (data.success) {
        setResult({ success: true, message: `Imported successfully! Anime ID: ${data.animeId}, Episodes added: ${data.episodesAdded}` });
        void utils.anime.list.invalidate();
        void utils.dashboard.stats.invalidate();
      } else {
        setResult({ success: false, message: data.error || "Failed to import" });
      }
    },
    onError: (err) => {
      setLoading(false);
      setResult({ success: false, message: err.message });
    },
  });

  const handleImport = () => {
    if (!slug.trim()) return;
    setLoading(true);
    setResult(null);
    importMutation.mutate({ source, slug: slug.trim(), importEpisodes: true });
  };

  return (
    <div>
      <div className="space-y-3 mb-3">
        <SourceSiteSelect value={source} onChange={setSource} options={sources} />
        <div className="flex gap-2">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g., rezero-kara-hajimeru-isekai-seikatsu-4th-season"
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-[#888888] focus:outline-none focus:border-[#693def] text-sm"
        />
        <button
          onClick={handleImport}
          disabled={loading || !slug.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#693def] text-white text-sm hover:bg-[#8257f2] disabled:opacity-50 transition-all"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <Download className="w-4 h-4" />
          Import
        </button>
        </div>
      </div>
      {result && (
        <div className={`p-3 rounded-lg text-sm ${result.success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
          {result.message}
        </div>
      )}
      <p className="text-xs text-[#888888] mt-2">
        Tip: Use the part after `/anime/` from {selectedSource?.animePathHint || "the source site"}.
      </p>
    </div>
  );
}

/* ─── Sync Episodes Form ─── */
function SyncEpisodesForm() {
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const utils = trpc.useUtils();
  const { data: animeList } = trpc.anime.list.useQuery({ limit: 100 });

  const syncMutation = trpc.scraper.syncAllEpisodes.useMutation({
    onSuccess: (data) => {
      setLoading(false);
      if ("queued" in data && data.queued) {
        setResult({
          success: true,
          message: `${data.message} Job #${data.jobId} is now waiting for the worker.`,
        });
        void utils.scraper.listScrapeJobs.invalidate();
        return;
      }
      if (data.success) {
        void utils.anime.list.invalidate();
        if (selectedAnimeId) {
          void utils.episode.list.invalidate({ animeId: Number(selectedAnimeId) });
        }
        const parts = [`Synced ${data.syncedCount} out of ${data.total} episodes`];
        if (data.missingCount) parts.push(`missing ${data.missingCount}`);
        if (data.failedCount) parts.push(`failed ${data.failedCount}`);
        setResult({ success: true, message: parts.join(", ") });
      } else {
        setResult({ success: false, message: data.error || "Failed to sync" });
      }
    },
    onError: (err) => {
      setLoading(false);
      setResult({ success: false, message: err.message });
    },
  });
  const refreshMetadataMutation = trpc.scraper.refreshAnimeMetadata.useMutation({
    onSuccess: (data) => {
      setRefreshing(false);
      if ("queued" in data && data.queued) {
        setResult({
          success: true,
          message: `${data.message} Job #${data.jobId} is now waiting for the worker.`,
        });
        void utils.scraper.listScrapeJobs.invalidate();
        return;
      }
      if (data.success) {
        void utils.anime.list.invalidate();
        setResult({ success: true, message: "Metadata refreshed successfully" });
      } else {
        setResult({ success: false, message: data.error || "Failed to refresh metadata" });
      }
    },
    onError: (err) => {
      setRefreshing(false);
      setResult({ success: false, message: err.message });
    },
  });

  const handleSync = () => {
    if (!selectedAnimeId) return;
    setLoading(true);
    setResult(null);
    syncMutation.mutate({ animeId: Number(selectedAnimeId) });
  };

  const handleRefreshMetadata = () => {
    if (!selectedAnimeId) return;
    setRefreshing(true);
    setResult(null);
    refreshMetadataMutation.mutate({ animeId: Number(selectedAnimeId) });
  };

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 xl:flex-row">
        <select
          value={selectedAnimeId}
          onChange={(e) => setSelectedAnimeId(e.target.value)}
          className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
        >
          <option value="">Select anime...</option>
          {animeList?.items.map((a) => (
            <option key={a.id} value={a.id}>{a.title}{a.sourceSite ? ` (${a.sourceSite})` : ""}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2 xl:flex-nowrap">
          <button
            onClick={handleSync}
            disabled={loading || !selectedAnimeId}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#693def] px-4 py-2 text-sm text-white transition-all hover:bg-[#8257f2] disabled:opacity-50 min-w-[120px]"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <RefreshCw className="w-4 h-4" />
            Sync
          </button>
          <button
            onClick={handleRefreshMetadata}
            disabled={refreshing || !selectedAnimeId}
            className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition-all hover:bg-white/20 disabled:opacity-50 min-w-[160px]"
          >
            {refreshing && <Loader2 className="w-4 h-4 animate-spin" />}
            <Globe className="w-4 h-4" />
            Refresh Metadata
          </button>
        </div>
      </div>
      {result && (
        <div className={`p-3 rounded-lg text-sm ${result.success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
          {result.message}
        </div>
      )}
      <p className="text-xs text-[#888888] mt-2">
        This will scrape video URLs for all episodes of the selected anime.
      </p>
    </div>
  );
}

/* ─── Latest Anime List ─── */
function LatestAnimeList() {
  const [source, setSource] = useState<SourceSiteId>("witanime");
  const [fetchedSource, setFetchedSource] = useState<SourceSiteId | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const utils = trpc.useUtils();
  const { data: sources } = trpc.scraper.getSources.useQuery();
  const selectedSource = sources?.find((site) => site.id === source);
  const latestQuery = trpc.scraper.getLatestFromSource.useQuery(
    { source, limit: 20 },
    {
      enabled: false,
      retry: false,
    },
  );
  const animeList: LatestSourceAnime[] = latestQuery.data?.data ?? [];
  const latestError =
    latestQuery.error?.message ||
    (latestQuery.data?.success === false ? latestQuery.data.error || "Could not fetch from source" : "");
  const loading = latestQuery.isFetching;
  const fetched = fetchedSource === source;

  const fetchLatest = async () => {
    setFetchedSource(source);
    setResult(null);
    await latestQuery.refetch();
  };

  const importMutation = trpc.scraper.importFromSource.useMutation({
    onSuccess: (data) => {
      if ("queued" in data && data.queued) {
        setResult({
          success: true,
          message: `${data.message} Job #${data.jobId} is now waiting for the worker.`,
        });
        void utils.scraper.listScrapeJobs.invalidate();
        return;
      }

      if (data.success) {
        setResult({
          success: true,
          message: `Imported successfully. Anime ID: ${data.animeId}, Episodes added: ${data.episodesAdded}`,
        });
        void utils.anime.list.invalidate();
        void utils.dashboard.stats.invalidate();
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to import from source",
        });
      }
    },
    onError: (error) => {
      setResult({
        success: false,
        message: error.message,
      });
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#888888]">Browse anime available on {selectedSource?.name || "the selected source"}</p>
        <div className="flex items-center gap-2">
          <div className="min-w-[180px]">
            <SourceSiteSelect value={source} onChange={setSource} options={sources} />
          </div>
          <button
            onClick={fetchLatest}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-50 transition-all"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Globe className="w-4 h-4" />
            Fetch Latest
          </button>
        </div>
      </div>

      {result && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${result.success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
          {result.message}
        </div>
      )}

      {animeList.length === 0 && fetched && !loading && (
        <div className="text-center py-8 text-[#888888]">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{latestError || "No anime found or could not fetch from source"}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {animeList.map((item) => (
          <div key={`${source}:${item.slug}`} className="bg-white/5 rounded-lg p-3">
            {item.coverImage && (
              <img src={item.coverImage} alt={item.title} className="w-full aspect-[2/3] object-cover rounded mb-2" />
            )}
            <p className="text-sm text-white font-medium line-clamp-2 mb-2">{item.title}</p>
            <button
              onClick={() => importMutation.mutate({ source, slug: item.slug, importEpisodes: true })}
              disabled={importMutation.isPending}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-[#693def]/20 text-[#693def] text-xs hover:bg-[#693def]/30 transition-all"
            >
              <Download className="w-3 h-3" />
              Import
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScrapeJobsPanel() {
  const { data: executionMode } = trpc.scraper.getExecutionMode.useQuery();
  const jobsQuery = trpc.scraper.listScrapeJobs.useQuery(
    { limit: 10 },
    {
      refetchInterval: executionMode?.queued ? 5000 : 15000,
    }
  );
  const jobs = jobsQuery.data ?? [];

  return (
    <div className="glass-panel p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Activity className="h-5 w-5 text-[#693def]" />
            Scraper Queue
          </h3>
          <p className="mt-1 text-sm text-[#888888]">
            {executionMode?.message || "See recent scraper jobs and whether the worker has picked them up yet."}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#cfc7ec]">
          {executionMode?.mode || "inline"}
        </div>
      </div>

      {jobsQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-[#9b93b8]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading scraper jobs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] py-10 text-center">
          <Activity className="mx-auto mb-3 h-8 w-8 text-white/25" />
          <p className="text-sm font-medium text-[#9b93b8]">No scraper jobs yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const statusClass =
              job.status === "completed"
                ? "bg-green-500/15 text-green-300"
                : job.status === "running"
                  ? "bg-sky-500/15 text-sky-300"
                  : job.status === "failed"
                    ? "bg-red-500/15 text-red-300"
                    : "bg-amber-500/15 text-amber-300";

            return (
              <div
                key={job.id}
                className="rounded-2xl border border-white/8 bg-white/[0.04] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {job.label}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClass}`}>
                        {job.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#8f86ad]">
                      {job.type.replace(/_/g, " ")}
                      {job.source ? ` • ${job.source}` : ""}
                      {job.animeSlug ? ` • ${job.animeSlug}` : ""}
                    </p>
                    {job.errorMessage && (
                      <p className="mt-2 text-sm text-red-300">{job.errorMessage}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-[#b8afda] sm:grid-cols-4">
                    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f86ad]">Job</p>
                      <p className="mt-1 font-semibold text-white">#{job.id}</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f86ad]">Created</p>
                      <p className="mt-1 font-semibold text-white">
                        {job.createdAt ? new Date(job.createdAt).toLocaleString() : "N/A"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f86ad]">Started</p>
                      <p className="mt-1 font-semibold text-white">
                        {job.startedAt ? new Date(job.startedAt).toLocaleString() : "Waiting"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f86ad]">Finished</p>
                      <p className="mt-1 font-semibold text-white">
                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : "In progress"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Admin Dashboard ─── */
export default function Admin() {
  const { isAdmin, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [animeFormOpen, setAnimeFormOpen] = useState(false);
  const [episodeFormOpen, setEpisodeFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingAnime, setEditingAnime] = useState<AdminAnime | null>(null);
  const [editingEpisode, setEditingEpisode] = useState<AdminEpisode | null>(null);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [selectedAnimeId, setSelectedAnimeId] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<number[]>([]);
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<number[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  const { data: stats } = trpc.dashboard.stats.useQuery(undefined, { enabled: isAdmin });
  const { data: recentUsers } = trpc.dashboard.recentUsers.useQuery(undefined, { enabled: isAdmin });
  const { data: recentAnime } = trpc.dashboard.recentAnime.useQuery(undefined, { enabled: isAdmin });
  const { data: topBrokenEpisodes } = trpc.dashboard.topBrokenEpisodes.useQuery(undefined, { enabled: isAdmin });
  const { data: animeList } = trpc.anime.list.useQuery({ search: searchQuery || undefined, limit: 50 });
  const { data: categories } = trpc.category.list.useQuery();
  const resolvedSelectedAnimeId =
    animeList?.items.some((item) => item.id === selectedAnimeId)
      ? selectedAnimeId
      : (animeList?.items[0]?.id ?? 0);
  const { data: episodeList } = trpc.episode.list.useQuery(
    { animeId: resolvedSelectedAnimeId },
    { enabled: resolvedSelectedAnimeId > 0 },
  );

  const utils = trpc.useUtils();
  const deleteAnime = trpc.anime.delete.useMutation({
    onSuccess: () => {
      utils.anime.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
  });
  const bulkDeleteAnime = trpc.anime.bulkDelete.useMutation({
    onSuccess: () => {
      setSelectedAnimeIds([]);
      utils.anime.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
  });
  const deleteEpisode = trpc.episode.delete.useMutation({
    onSuccess: () => {
      utils.episode.list.invalidate({ animeId: resolvedSelectedAnimeId });
      utils.dashboard.stats.invalidate();
    },
  });
  const bulkDeleteEpisode = trpc.episode.bulkDelete.useMutation({
    onSuccess: () => {
      setSelectedEpisodeIds([]);
      utils.episode.list.invalidate({ animeId: resolvedSelectedAnimeId });
      utils.dashboard.stats.invalidate();
    },
  });
  const deleteCategory = trpc.category.delete.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      utils.anime.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
  });
  const bulkDeleteCategory = trpc.category.bulkDelete.useMutation({
    onSuccess: () => {
      setSelectedCategoryIds([]);
      utils.category.list.invalidate();
      utils.anime.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
  });

  const toggleSelection = (
    id: number,
    selectedIds: number[],
    setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>,
  ) => {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id],
    );
  };

  const toggleSelectAll = (
    ids: number[],
    selectedIds: number[],
    setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>,
  ) => {
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedIds.includes(id));
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...selectedIds, ...ids])),
    );
  };

  const visibleAnimeIds = animeList?.items.map((item) => item.id) ?? [];
  const visibleEpisodeIds = episodeList?.map((item) => item.id) ?? [];
  const visibleCategoryIds = categories?.map((item) => item.id) ?? [];
  const effectiveSelectedAnimeIds = selectedAnimeIds.filter((id) => visibleAnimeIds.includes(id));
  const effectiveSelectedEpisodeIds = selectedEpisodeIds.filter((id) => visibleEpisodeIds.includes(id));
  const effectiveSelectedCategoryIds = selectedCategoryIds.filter((id) => visibleCategoryIds.includes(id));
  const allAnimeSelected = visibleAnimeIds.length > 0 && visibleAnimeIds.every((id) => effectiveSelectedAnimeIds.includes(id));
  const allEpisodesSelected = visibleEpisodeIds.length > 0 && visibleEpisodeIds.every((id) => effectiveSelectedEpisodeIds.includes(id));
  const allCategoriesSelected = visibleCategoryIds.length > 0 && visibleCategoryIds.every((id) => effectiveSelectedCategoryIds.includes(id));

  const handleBulkAnimeDelete = () => {
    if (effectiveSelectedAnimeIds.length === 0) return;
    if (!confirm(`Delete ${effectiveSelectedAnimeIds.length} selected anime?`)) return;
    bulkDeleteAnime.mutate({ ids: effectiveSelectedAnimeIds });
  };

  const handleBulkEpisodeDelete = () => {
    if (effectiveSelectedEpisodeIds.length === 0) return;
    if (!confirm(`Delete ${effectiveSelectedEpisodeIds.length} selected episodes?`)) return;
    bulkDeleteEpisode.mutate({ ids: effectiveSelectedEpisodeIds });
  };

  const handleBulkCategoryDelete = () => {
    if (effectiveSelectedCategoryIds.length === 0) return;
    if (!confirm(`Delete ${effectiveSelectedCategoryIds.length} selected genres/categories?`)) return;
    bulkDeleteCategory.mutate({ ids: effectiveSelectedCategoryIds });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030209] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#693def] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#030209] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-xl text-white mb-2">Access Denied</p>
          <p className="text-sm text-[#888888] mb-6">You need admin privileges to access this page</p>
          <Link to="/" className="text-[#693def] hover:underline">Go Home</Link>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "anime", label: "Anime", icon: Tv },
    { key: "episodes", label: "Episodes", icon: Film },
    { key: "categories", label: "Categories", icon: Layers },
    { key: "reports", label: "Broken Episodes", icon: Flag },
    { key: "scraper", label: "Import Sources", icon: Download },
  ];

  return (
    <div className="min-h-screen bg-[#030209]">
      {/* Header */}
      <div className="bg-[#030209] pt-[150px] pb-4 px-4 sm:px-6 lg:px-8 border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#693def]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#693def]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-sm text-[#888888]">Manage your anime platform</p>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto scroll-hide">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? "bg-[#693def] text-white"
                    : "text-[#888888] hover:text-white hover:bg-white/5"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard title="Total Users" value={stats?.totalUsers || 0} icon={Users} color="bg-blue-500/20" />
              <StatCard title="Anime Series" value={stats?.totalAnime || 0} icon={Tv} color="bg-[#693def]/20" />
              <StatCard title="Episodes" value={stats?.totalEpisodes || 0} icon={Film} color="bg-green-500/20" />
              <StatCard title="Reviews" value={stats?.totalReviews || 0} icon={MessageSquare} color="bg-yellow-500/20" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Users */}
              <div className="glass-panel p-5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#693def]" />
                  Recent Users
                </h3>
                <div className="space-y-3">
                  {recentUsers?.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                      <img src={u.avatar || "/avatars/user1.jpg"} alt="" className="w-8 h-8 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.name || "Unknown"}</p>
                        <p className="text-xs text-[#888888] truncate">{u.email}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === "admin" ? "bg-[#693def]/20 text-[#693def]" : "bg-white/5 text-[#888888]"
                      }`}>
                        {u.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Anime */}
              <div className="glass-panel p-5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#693def]" />
                  Recently Added
                </h3>
                <div className="space-y-3">
                  {recentAnime?.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                      <AnimeArtwork
                        src={a.coverImage}
                        alt={a.title}
                        title={a.title}
                        className="w-10 h-14 rounded"
                        imageClassName="w-10 h-14 rounded object-cover"
                        fallbackClassName="w-10 h-14 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{a.title}</p>
                        <p className="text-xs text-[#888888]">{a.status} • {a.score} ★</p>
                      </div>
                      <Link to={`/anime/${a.slug}`} className="text-[#693def] hover:text-[#8257f2]">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* Anime Tab */}
        {activeTab === "anime" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888]" />
                  <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedAnimeIds([]);
                  }}
                  placeholder="Search anime..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-[#888888] focus:outline-none focus:border-[#693def] text-sm"
                />
                </div>
                <button
                  onClick={() => { setEditingAnime(null); setAnimeFormOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#693def] text-white text-sm font-medium hover:bg-[#8257f2] transition-all ml-4"
                >
                  <Plus className="w-4 h-4" />
                  Add Anime
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={allAnimeSelected}
                    onChange={() => toggleSelectAll(visibleAnimeIds, selectedAnimeIds, setSelectedAnimeIds)}
                    className="h-4 w-4 accent-[#693def]"
                  />
                  Select all visible
                </label>
                <span className="text-sm text-[#888888]">
                  {effectiveSelectedAnimeIds.length} selected
                </span>
                <button
                  onClick={handleBulkAnimeDelete}
                  disabled={effectiveSelectedAnimeIds.length === 0 || bulkDeleteAnime.isPending}
                  className="flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300 transition-all hover:bg-red-500/25 disabled:opacity-50"
                >
                  {bulkDeleteAnime.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
              </div>
            </div>

            <div className="glass-panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allAnimeSelected}
                          onChange={() => toggleSelectAll(visibleAnimeIds, selectedAnimeIds, setSelectedAnimeIds)}
                          className="h-4 w-4 accent-[#693def]"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Anime</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Score</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Episodes</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Year</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {animeList?.items.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedAnimeIds.includes(a.id)}
                            onChange={() => toggleSelection(a.id, selectedAnimeIds, setSelectedAnimeIds)}
                            className="h-4 w-4 accent-[#693def]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <AnimeArtwork
                              src={a.coverImage}
                              alt={a.title}
                              title={a.title}
                              className="w-10 h-14 rounded"
                              imageClassName="w-10 h-14 rounded object-cover"
                              fallbackClassName="w-10 h-14 rounded"
                            />
                            <div>
                              <p className="text-sm font-medium text-white">{a.title}</p>
                              <p className="text-xs text-[#888888]">{a.genreNames || a.categoryName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            a.status === "ongoing" ? "bg-green-500/20 text-green-400" :
                            a.status === "completed" ? "bg-blue-500/20 text-blue-400" :
                            "bg-yellow-500/20 text-yellow-400"
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-sm text-yellow-400">
                            <Star className="w-3 h-3 fill-yellow-400" />
                            {a.score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#cccccc]">{a.episodesCount}</td>
                        <td className="px-4 py-3 text-sm text-[#cccccc]">{a.releaseYear}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditingAnime(a); setAnimeFormOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-[#888888] hover:text-white transition-all"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { if (confirm("Delete this anime?")) deleteAnime.mutate({ id: a.id }); }}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#888888] hover:text-red-400 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Episodes Tab */}
        {activeTab === "episodes" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <select
                  value={resolvedSelectedAnimeId}
                  onChange={(e) => {
                    setSelectedAnimeId(Number(e.target.value));
                    setSelectedEpisodeIds([]);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-[#693def] text-sm placeholder:text-gray-500"
                >
                  {animeList?.items.map((a) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
                <button
                  onClick={() => { setEditingEpisode(null); setEpisodeFormOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#693def] text-white text-sm font-medium hover:bg-[#8257f2] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Episode
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={allEpisodesSelected}
                    onChange={() => toggleSelectAll(visibleEpisodeIds, selectedEpisodeIds, setSelectedEpisodeIds)}
                    className="h-4 w-4 accent-[#693def]"
                  />
                  Select all visible
                </label>
                <span className="text-sm text-[#888888]">
                  {effectiveSelectedEpisodeIds.length} selected
                </span>
                <button
                  onClick={handleBulkEpisodeDelete}
                  disabled={effectiveSelectedEpisodeIds.length === 0 || bulkDeleteEpisode.isPending}
                  className="flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300 transition-all hover:bg-red-500/25 disabled:opacity-50"
                >
                  {bulkDeleteEpisode.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
              </div>
            </div>

            <div className="glass-panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allEpisodesSelected}
                          onChange={() => toggleSelectAll(visibleEpisodeIds, selectedEpisodeIds, setSelectedEpisodeIds)}
                          className="h-4 w-4 accent-[#693def]"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase">#</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Title</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Duration</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Air Date</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {episodeList?.map((ep) => (
                      <tr key={ep.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEpisodeIds.includes(ep.id)}
                            onChange={() => toggleSelection(ep.id, selectedEpisodeIds, setSelectedEpisodeIds)}
                            className="h-4 w-4 accent-[#693def]"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-[#693def] font-mono font-bold">{ep.number}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-white">{ep.title || `Episode ${ep.number}`}</p>
                          {ep.synopsis && <p className="text-xs text-[#888888] line-clamp-1">{ep.synopsis}</p>}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#cccccc]">
                          {ep.duration ? `${Math.floor(ep.duration / 60)} min` : "??"}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#cccccc]">
                          {ep.airDate ? new Date(ep.airDate).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditingEpisode(ep); setEpisodeFormOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-[#888888] hover:text-white transition-all"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { if (confirm("Delete this episode?")) deleteEpisode.mutate({ id: ep.id }); }}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#888888] hover:text-red-400 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Categories Tab */}
        {activeTab === "categories" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Categories ({categories?.length || 0})</h2>
                <button
                  onClick={() => { setEditingCategory(null); setCategoryFormOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#693def] text-white text-sm font-medium hover:bg-[#8257f2] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={allCategoriesSelected}
                    onChange={() => toggleSelectAll(visibleCategoryIds, selectedCategoryIds, setSelectedCategoryIds)}
                    className="h-4 w-4 accent-[#693def]"
                  />
                  Select all visible
                </label>
                <span className="text-sm text-[#888888]">
                  {effectiveSelectedCategoryIds.length} selected
                </span>
                <button
                  onClick={handleBulkCategoryDelete}
                  disabled={effectiveSelectedCategoryIds.length === 0 || bulkDeleteCategory.isPending}
                  className="flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300 transition-all hover:bg-red-500/25 disabled:opacity-50"
                >
                  {bulkDeleteCategory.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories?.map((cat) => (
                <div key={cat.id} className="glass-panel p-4 group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(cat.id)}
                        onChange={() => toggleSelection(cat.id, selectedCategoryIds, setSelectedCategoryIds)}
                        className="mt-1 h-4 w-4 accent-[#693def]"
                      />
                      <h3 className="text-lg font-semibold text-white">{cat.name}</h3>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingCategory(cat); setCategoryFormOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-[#888888] hover:text-white transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Delete this category?")) deleteCategory.mutate({ id: cat.id }); }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#888888] hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[#888888] mb-2">{cat.slug}</p>
                  {cat.description && (
                    <p className="text-xs text-[#cccccc] line-clamp-2">{cat.description}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}


        {/* Broken Reports Tab */}
        {activeTab === "reports" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-panel p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                    <Flag className="w-5 h-5 text-amber-300" />
                    Broken Episode Reports
                  </h2>
                  <p className="mt-1 text-sm text-[#9b93b8]">
                    See which episodes users report as broken most often so you can resync or replace their sources.
                  </p>
                </div>
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
                  {topBrokenEpisodes?.length ?? 0} reported episode{(topBrokenEpisodes?.length ?? 0) === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div className="glass-panel p-5">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                <Flag className="w-5 h-5 text-amber-300" />
                Most Reported Broken Episodes
              </h3>

              {!topBrokenEpisodes || topBrokenEpisodes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] py-10 text-center">
                  <Flag className="mx-auto mb-3 h-8 w-8 text-white/25" />
                  <p className="text-sm font-medium text-[#9b93b8]">No episode reports yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topBrokenEpisodes.map((item) => (
                    <div key={item.episodeId} className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{item.animeTitle}</p>
                        <p className="mt-1 truncate text-sm text-[#c9c1df]">
                          Episode {item.episodeNumber}
                          {item.episodeTitle ? ` - ${item.episodeTitle}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-[#8f86ad]">
                          Last report: {item.lastReportedAt ? new Date(item.lastReportedAt).toLocaleString() : "N/A"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/70">24h</p>
                          <p className="text-lg font-black text-amber-100">{item.reportsLast24h}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9188b1]">Total</p>
                          <p className="text-lg font-black text-white">{item.reportsCount}</p>
                        </div>
                        <Link
                          to={`/watch/${item.animeSlug}/${item.episodeNumber}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#693def]/15 px-3 py-2 text-sm font-semibold text-[#d8cbff] transition hover:bg-[#693def]/25 hover:text-white"
                        >
                          Open
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Scraper Tab */}
        {activeTab === "scraper" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Import Anime */}
              <div className="glass-panel p-5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-[#693def]" />
                  Import from source
                </h3>
                <p className="text-sm text-[#888888] mb-4">
                  Choose a source site, then enter the anime slug to import it with all episodes.
                </p>
                <ImportAnimeForm />
              </div>

              {/* Sync Episode Sources */}
              <div className="glass-panel p-5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-[#693def]" />
                  Sync Video Sources
                </h3>
                <p className="text-sm text-[#888888] mb-4">
                  Rescrape episode players using the source site stored on that anime.
                </p>
                <SyncEpisodesForm />
              </div>

              {/* Latest from Source */}
              <div className="glass-panel p-5 lg:col-span-2">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#693def]" />
                  Latest Anime by source
                </h3>
                <LatestAnimeList />
              </div>

              <div className="lg:col-span-2">
                <ScrapeJobsPanel />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      {animeFormOpen && (
        <AnimeFormModal
          anime={editingAnime ?? undefined}
          onClose={() => { setAnimeFormOpen(false); setEditingAnime(null); }}
        />
      )}
      {episodeFormOpen && (
        <EpisodeFormModal
          animeId={resolvedSelectedAnimeId}
          episode={editingEpisode ?? undefined}
          onClose={() => { setEpisodeFormOpen(false); setEditingEpisode(null); }}
        />
      )}
      {categoryFormOpen && (
        <CategoryFormModal
          category={editingCategory ?? undefined}
          onClose={() => { setCategoryFormOpen(false); setEditingCategory(null); }}
        />
      )}
    </div>
  );
}
