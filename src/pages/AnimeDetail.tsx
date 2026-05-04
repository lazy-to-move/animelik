import { useParams, Link } from "react-router";
import { motion } from "framer-motion";
import {
  Play, Plus, Star, Clock, Calendar, Building2, Tv, BookmarkCheck,
  MessageSquare, ChevronLeft, SlidersHorizontal
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import AnimeArtwork from "@/components/AnimeArtwork";
import MixedSynopsisText from "@/components/MixedSynopsisText";

function normalizeAnimeSlug(slug?: string | null) {
  return (slug ?? "").replace(/^\/+|\/+$/g, "");
}

export default function AnimeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(8);

  const { data: anime, isLoading } = trpc.anime.bySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );
  const { data: episodeList } = trpc.episode.list.useQuery(
    { animeId: anime?.id || 0 },
    { enabled: !!anime?.id }
  );
  const { data: reviews } = trpc.review.list.useQuery(
    { animeId: anime?.id || 0 },
    { enabled: !!anime?.id }
  );
  const { data: watchlistItems } = trpc.watchlist.list.useQuery(undefined, {
    enabled: !!user,
  });

  const utils = trpc.useUtils();
  const addWatchlist = trpc.watchlist.add.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  });
  const createReview = trpc.review.create.useMutation({
    onSuccess: () => {
      utils.review.list.invalidate({ animeId: anime?.id || 0 });
      setReviewText("");
    },
  });

  const isInWatchlist = watchlistItems?.some((w) => w.animeId === anime?.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030209] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#693def] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="min-h-screen bg-[#030209] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-[#888888] mb-4">Anime not found</p>
          <Link to="/browse" className="text-[#693def] hover:underline">Back to Browse</Link>
        </div>
      </div>
    );
  }

  const heroImage = anime.bannerImage || anime.coverImage;
  const hasDedicatedBanner = Boolean(anime.bannerImage && anime.bannerImage !== anime.coverImage);

  return (
    <div className="min-h-screen bg-[#030209]">
      {/* Banner */}
      <div className="relative h-[45vh] sm:h-[55vh] overflow-hidden">
        {hasDedicatedBanner ? (
          <AnimeArtwork
            src={heroImage}
            alt={anime.title}
            title={anime.title}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover"
            fallbackClassName="w-full h-full"
          />
        ) : (
          <>
            <div className="absolute inset-0 scale-110 opacity-85">
              <AnimeArtwork
                src={anime.coverImage}
                alt={anime.title}
                title={anime.title}
                className="w-full h-full"
                imageClassName="w-full h-full object-cover blur-2xl"
                fallbackClassName="w-full h-full"
              />
            </div>
            <div className="absolute inset-0 opacity-30">
              <AnimeArtwork
                src={anime.coverImage}
                alt={anime.title}
                title={anime.title}
                className="w-full h-full"
                imageClassName="w-full h-full object-cover scale-105"
                fallbackClassName="w-full h-full"
              />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(130,87,242,0.2),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.08),transparent_28%)]" />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030209] via-[#030209]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#030209]/60 to-transparent" />
        <div className="absolute inset-0 bg-black/25" />

        <div className="absolute top-24 left-4 sm:left-8 z-20">
          <Link
            to="/browse"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs font-black text-white hover:bg-[#693def] transition-all duration-300 uppercase tracking-widest"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Browse
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-48 sm:-mt-64 relative z-10 pb-20">
        <div className="grid lg:grid-cols-[320px_1fr] gap-12">
          {/* Left: Poster & Actions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative aspect-[2/3] w-full mx-auto rounded-[2.5rem] overflow-hidden mb-8 shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-white/10 bg-[#0c0a15]">
              {/* Ambient Backdrop Layer */}
              <div className="absolute inset-0 opacity-20 blur-xl scale-110">
                <AnimeArtwork
                  src={anime.coverImage}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Sharp Poster Layer */}
              <div className="relative w-full h-full flex items-center justify-center">
                <AnimeArtwork
                  src={anime.coverImage}
                  alt={anime.title}
                  title={anime.title}
                  className="w-full h-full object-cover rounded-[2.5rem]"
                  imageClassName="w-full h-full object-cover rounded-[2.5rem]"
                  fallbackClassName="w-full h-full object-cover rounded-[2.5rem]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to={`/watch/${normalizeAnimeSlug(anime.slug)}/1`}
                className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#693def] text-white font-bold hover:bg-[#8257f2] transition-all duration-300 hover:scale-[1.02] shadow-xl shadow-[#693def]/20"
              >
                <Play className="w-5 h-5 fill-white" />
                شاهد الحلقة 1
              </Link>
              {user && (
                <button
                  onClick={() => {
                    if (!isInWatchlist) {
                      addWatchlist.mutate({ animeId: anime.id });
                    }
                  }}
                  disabled={isInWatchlist || addWatchlist.isPending}
                  className={`flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 font-bold transition-all duration-300 hover:scale-[1.02] ${
                    isInWatchlist
                      ? "border-green-500/20 bg-green-500/10 text-green-400"
                      : "border-white/10 text-white hover:bg-white/5 hover:border-white/20"
                  }`}
                >
                  {isInWatchlist ? (
                    <>
                      <BookmarkCheck className="w-5 h-5" />
                      In Watchlist
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add to Watchlist
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>

          {/* Right: Info */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="pt-12 sm:pt-20"
          >
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="px-3 py-1.5 rounded-lg bg-[#693def]/15 text-[#8257f2] text-[10px] font-black uppercase tracking-widest border border-[#693def]/20">
                {anime.status}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[#aaaaaa] text-[10px] font-black uppercase tracking-widest border border-white/5">
                {anime.type}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[#aaaaaa] text-[10px] font-black uppercase tracking-widest border border-white/5">
                {anime.rating}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-2 tracking-tight leading-tight">{anime.title}</h1>
            {anime.titleJp && (
              <p className="text-xl sm:text-2xl text-[#8257f2] font-bold mb-6 tracking-wide opacity-80">{anime.titleJp}</p>
            )}

            <div className="flex items-center gap-6 mb-8 py-4 border-y border-white/5">
              <div className="flex items-center gap-2 text-yellow-400">
                <Star className="w-6 h-6 fill-yellow-400" />
                <span className="text-xl font-black">{anime.score}</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-2 text-[#dddddd]">
                <Tv className="w-5 h-5 text-[#693def]" />
                <span className="font-bold text-sm uppercase tracking-tight">{anime.episodesCount} Episodes</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-2 text-[#dddddd]">
                <Clock className="w-5 h-5 text-[#693def]" />
                <span className="font-bold text-sm uppercase tracking-tight">{anime.duration} Min</span>
              </div>
            </div>

            <MixedSynopsisText className="mb-10 text-lg font-medium leading-relaxed text-[#bbbbbb]" preserveLines>
              {anime.synopsis}
            </MixedSynopsisText>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-xs font-black text-[#666666] mb-2 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Year
                </p>
                <p className="text-base font-bold text-white">{anime.releaseYear || "????"}</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-xs font-black text-[#666666] mb-2 uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> Studio
                </p>
                <p className="text-base font-bold text-white">{anime.studio || "Unknown"}</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-xs font-black text-[#666666] mb-2 uppercase tracking-widest flex items-center gap-2">
                   <SlidersHorizontal className="w-3.5 h-3.5" /> Genre
                </p>
                <p className="text-base font-bold text-white">{anime.genreNames || anime.categoryName || "Unknown"}</p>
              </div>
            </div>

            {/* Episodes */}
            <div className="mb-12">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <div className="w-2 h-8 bg-[#693def] rounded-full" />
                Episodes
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto scroll-hide pr-2">
                {episodeList?.map((ep) => (
                  <Link
                    key={ep.id}
                    to={`/watch/${normalizeAnimeSlug(anime.slug)}/${ep.number}`}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-[#693def]/10 border border-white/5 hover:border-[#693def]/40 transition-all duration-300 group"
                  >
                    <div className="relative w-28 aspect-video rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                      <AnimeArtwork
                        src={ep.thumbnail || anime.coverImage}
                        alt={ep.title ?? `الحلقة ${ep.number}`}
                        title={anime.title}
                        className="w-full h-full"
                        imageClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        fallbackClassName="w-full h-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Play className="w-6 h-6 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="mb-1 text-xs font-black tracking-widest text-[#693def]">الحلقة {ep.number}</p>
                      <p className="text-[15px] font-bold text-white truncate group-hover:text-[#693def] transition-colors">
                        {ep.title || `الحلقة ${ep.number}`}
                      </p>
                      <p className="text-xs text-[#777777] font-medium mt-1">
                        {ep.duration ? `${Math.floor(ep.duration / 60)} min` : "?? min"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#693def]" />
                Reviews ({reviews?.length || 0})
              </h2>

              {/* Add Review */}
              {user && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                  <p className="text-sm font-medium text-white mb-3">Write a Review</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-[#888888]">Rating:</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="w-32 accent-[#693def]"
                    />
                    <span className="text-sm font-bold text-yellow-400">{reviewRating}/10</span>
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share your thoughts..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-[#888888] focus:outline-none focus:border-[#693def] text-sm resize-none mb-3"
                  />
                  <button
                    onClick={() => {
                      if (reviewText.trim()) {
                        createReview.mutate({
                          animeId: anime.id,
                          rating: reviewRating,
                          comment: reviewText.trim(),
                        });
                      }
                    }}
                    disabled={!reviewText.trim() || createReview.isPending}
                    className="px-4 py-2 rounded-lg bg-[#693def] text-white text-sm font-medium hover:bg-[#8257f2] disabled:opacity-30 transition-all"
                  >
                    {createReview.isPending ? "Posting..." : "Post Review"}
                  </button>
                </div>
              )}

              {/* Review List */}
              <div className="space-y-4">
                {reviews?.length === 0 && (
                  <p className="text-sm text-[#888888]">No reviews yet. Be the first to review!</p>
                )}
                {reviews?.map((review) => (
                  <div key={review.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={review.userAvatar || "/avatars/user1.jpg"}
                        alt={review.userName || "User"}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium text-white">{review.userName || "Anonymous"}</p>
                        <p className="text-xs text-[#888888]">
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md bg-[#693def]/20">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-bold text-yellow-400">{review.rating}</span>
                      </div>
                    </div>
                    <p className="text-sm text-[#cccccc] leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
