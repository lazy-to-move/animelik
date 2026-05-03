import { Link } from "react-router";
import { motion } from "framer-motion";
import { Play, Trash2, BookmarkX, Tv } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import AnimeArtwork from "@/components/AnimeArtwork";

const statusColors: Record<string, string> = {
  watching: "bg-green-500/20 text-green-400",
  completed: "bg-blue-500/20 text-blue-400",
  plan_to_watch: "bg-yellow-500/20 text-yellow-400",
  dropped: "bg-red-500/20 text-red-400",
};

const statusLabels: Record<string, string> = {
  watching: "Watching",
  completed: "Completed",
  plan_to_watch: "Plan to Watch",
  dropped: "Dropped",
};

export default function Watchlist() {
  const { user, isLoading: authLoading } = useAuth();
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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#030209] flex items-center justify-center pt-20">
        <div className="w-10 h-10 border-2 border-[#693def] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#030209] flex items-center justify-center pt-20">
        <div className="text-center">
          <BookmarkX className="w-12 h-12 text-[#888888] mx-auto mb-4" />
          <p className="text-xl text-white mb-2">Sign in to view your watchlist</p>
          <p className="text-sm text-[#888888] mb-6">Track your anime progress and never miss an episode</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#693def] text-white font-semibold hover:bg-[#8257f2] transition-all"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030209] pt-[150px] pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">My Watchlist</h1>
          <p className="text-[#888888]">{watchlistItems?.length || 0} anime in your list</p>
        </motion.div>

        {watchlistItems?.length === 0 ? (
          <div className="text-center py-20">
            <Tv className="w-12 h-12 text-[#888888] mx-auto mb-4" />
            <p className="text-xl text-white mb-2">Your watchlist is empty</p>
            <p className="text-sm text-[#888888] mb-6">Start adding anime from the browse page</p>
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#693def] text-white font-semibold hover:bg-[#8257f2] transition-all"
            >
              Browse Anime
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlistItems?.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass-panel overflow-hidden group"
              >
                <Link to={`/anime/${item.animeSlug}`} className="block">
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <AnimeArtwork
                      src={item.animeCover}
                      alt={item.animeTitle || ""}
                      title={item.animeTitle}
                      className="w-full h-full"
                      imageClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      fallbackClassName="w-full h-full transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 card-overlay" />
                    <div className="absolute top-3 left-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[item.status || "watching"]}`}>
                        {statusLabels[item.status || "watching"]}
                      </span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-[#693def]/90 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="p-4">
                  <Link to={`/anime/${item.animeSlug}`}>
                    <h3 className="text-sm font-semibold text-white truncate group-hover:text-[#8257f2] transition-colors mb-2">
                      {item.animeTitle}
                    </h3>
                  </Link>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-[#888888] mb-1">
                      <span>Progress</span>
                      <span>{item.currentEpisode || 0} / {item.animeEpisodesCount || "?"}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#693def] transition-all"
                        style={{
                          width: `${Math.min(100, ((item.currentEpisode || 0) / (item.animeEpisodesCount || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={item.status || "watching"}
                      onChange={(e) =>
                        updateMutation.mutate({ id: item.id, status: e.target.value as any })
                      }
                      className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#693def]"
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeMutation.mutate({ id: item.id })}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
