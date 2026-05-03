import { useParams, Link, useNavigate } from "react-router";
import {
  ChevronLeft, ChevronRight, Play, List, MessageSquare,
  Star, Send, Settings, Globe
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import AnimeArtwork from "@/components/AnimeArtwork";

function normalizeAnimeSlug(slug?: string | null) {
  return (slug ?? "").replace(/^\/+|\/+$/g, "");
}

interface VideoSource {
  server: string;
  quality: "sd" | "hd" | "fhd";
  url: string;
}

const SERVER_NAMES: Record<string, string> = {
  streamwish: "StreamWish",
  mp4upload: "MP4Upload",
  yonaplay: "YonaPlay",
  videa: "Videa",
  voe: "Voe",
  uqload: "Uqload",
  vkvideo: "VKVideo",
  fileupload: "File-Upload",
  share4max: "Share4Max",
  larhu: "Larhu",
  dsvplay: "DSVPlay",
  mega: "Mega.nz",
  fourShared: "4Shared",
  soraplay: "Soraplay",
};

const QUALITY_LABELS: Record<VideoSource["quality"], string> = {
  sd: "SD (480p)",
  hd: "HD (720p)",
  fhd: "FHD (1080p)",
};

const SERVER_PRIORITY = ["streamwish", "yonaplay", "videa", "mp4upload", "voe", "uqload", "vkvideo", "fileupload", "share4max", "larhu", "dsvplay", "mega", "fourShared", "soraplay"] as const;
const QUALITY_ORDER: VideoSource["quality"][] = ["fhd", "hd", "sd"];

function parseVideoSources(rawSources: unknown): VideoSource[] {
  try {
    const parsed = typeof rawSources === "string" ? JSON.parse(rawSources) : rawSources;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((source): source is VideoSource => {
      if (!source || typeof source !== "object") return false;
      const item = source as Partial<VideoSource>;

      return Boolean(
        typeof item.server === "string" &&
        typeof item.quality === "string" &&
        typeof item.url === "string" &&
        /^https?:\/\//i.test(item.url),
      );
    });
  } catch {
    return [];
  }
}

function sortServers(servers: string[]) {
  return servers.sort((a, b) => {
    const aIndex = SERVER_PRIORITY.indexOf(a as (typeof SERVER_PRIORITY)[number]);
    const bIndex = SERVER_PRIORITY.indexOf(b as (typeof SERVER_PRIORITY)[number]);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
}

export default function Watch() {
  const { slug, episodeNum } = useParams<{ slug: string; episodeNum: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(8);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [selectedQuality, setSelectedQuality] = useState<VideoSource["quality"]>("hd");

  const currentEpNum = Number(episodeNum) || 1;

  const { data: anime } = trpc.anime.bySlug.useQuery(
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

  const utils = trpc.useUtils();
  const createReview = trpc.review.create.useMutation({
    onSuccess: () => {
      utils.review.list.invalidate({ animeId: anime?.id || 0 });
      setReviewText("");
    },
  });

  const currentEpisode = episodeList?.find((episode) => episode.number === currentEpNum);
  const prevEpisode = episodeList?.find((episode) => episode.number === currentEpNum - 1);
  const nextEpisode = episodeList?.find((episode) => episode.number === currentEpNum + 1);

  const videoSources = useMemo(() => parseVideoSources(currentEpisode?.videoSources), [currentEpisode?.videoSources]);

  const availableServers = useMemo(
    () => sortServers(Array.from(new Set(videoSources.map((source) => source.server)))),
    [videoSources],
  );

  const filteredSources = useMemo(() => {
    if (!selectedServer) return videoSources;
    return videoSources.filter((source) => source.server === selectedServer);
  }, [videoSources, selectedServer]);

  const availableQualities = useMemo(() => {
    return QUALITY_ORDER.filter((quality) => filteredSources.some((source) => source.quality === quality));
  }, [filteredSources]);

  const currentSource = useMemo(() => {
    const selected = filteredSources.find((source) => source.quality === selectedQuality);
    if (selected) return selected;
    return filteredSources[0];
  }, [filteredSources, selectedQuality]);

  useEffect(() => {
    if (availableServers.length === 0) {
      setSelectedServer("");
      return;
    }

    const preferredServer = availableServers.find((server) => server === "streamwish") ?? availableServers[0];
    setSelectedServer(preferredServer);
  }, [currentEpisode?.id, availableServers]);

  useEffect(() => {
    if (availableQualities.length === 0) {
      setSelectedQuality("hd");
      return;
    }

    setSelectedQuality((current) => (
      availableQualities.includes(current) ? current : (availableQualities[0] ?? "hd")
    ));
  }, [availableQualities]);

  if (!anime) {
    return (
      <div className="min-h-screen bg-[#030209] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#693def] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasSources = videoSources.length > 0;
  const animeSlug = normalizeAnimeSlug(anime.slug);

  return (
    <div className="min-h-screen bg-[#030209] pt-20">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="relative aspect-video overflow-hidden rounded-3xl border border-white/5 bg-black shadow-[0_0_42px_rgba(105,61,239,0.12)]">
                {hasSources && currentSource?.url ? (
                  <iframe
                    src={currentSource.url}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`Player - ${currentSource.server}`}
                  />
                ) : currentEpisode?.videoUrl ? (
                  <video
                    src={currentEpisode.videoUrl}
                    controls
                    className="h-full w-full object-contain"
                    poster={currentEpisode.thumbnail || anime.coverImage || undefined}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-12 text-center">
                    <div>
                      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#693def]/10">
                        <Play className="h-10 w-10 fill-[#693def] text-[#693def]" />
                      </div>
                      <h2 className="mb-2 text-2xl font-black tracking-tight text-white">{anime.title}</h2>
                      <p className="mb-4 text-lg font-bold text-[#8257f2] opacity-80">
                        {currentEpisode?.title || `الحلقة ${currentEpNum}`}
                      </p>
                      <p className="mx-auto max-w-md text-sm font-medium leading-relaxed text-[#6f6986]">
                        We&apos;re still preparing this episode stream. Try another source or come back in a moment.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {hasSources && (
                <div className="rounded-3xl border border-white/10 bg-[rgba(13,10,24,0.92)] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)]">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5">
                          <Globe className="h-5 w-5 text-[#693def]" />
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555555]">Server</p>
                          <select
                            value={selectedServer}
                            onChange={(event) => setSelectedServer(event.target.value)}
                            className="cursor-pointer bg-transparent text-sm font-bold text-white focus:outline-none"
                          >
                            {availableServers.map((server) => (
                              <option key={server} value={server} className="bg-[#0e0c14]">
                                {SERVER_NAMES[server] || server}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="hidden h-10 w-px bg-white/5 sm:block" />

                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5">
                          <Settings className="h-5 w-5 text-[#693def]" />
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555555]">Quality</p>
                          <select
                            value={selectedQuality}
                            onChange={(event) => setSelectedQuality(event.target.value as VideoSource["quality"])}
                            className="cursor-pointer bg-transparent text-sm font-bold text-white focus:outline-none"
                          >
                            {availableQualities.map((quality) => (
                              <option key={quality} value={quality} className="bg-[#0e0c14]">
                                {QUALITY_LABELS[quality]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
                    <div className="rounded-2xl border border-[#693def]/10 bg-[#693def]/5 px-4 py-2">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#8257f2]">
                        Stream • {SERVER_NAMES[selectedServer] || selectedServer || "Auto"}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#6e6885]">Select a working host and quality for this episode.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-panel rounded-[2.5rem] p-8">
              <div className="mb-8 flex flex-col justify-between gap-6 border-b border-white/5 pb-8 md:flex-row md:items-center">
                <div>
                  <h1 className="mb-2 text-3xl font-black tracking-tight text-white">{anime.title}</h1>
                  <p className="text-xl font-bold text-[#693def] opacity-90">{currentEpisode?.title || `الحلقة ${currentEpNum}`}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/watch/${animeSlug}/${prevEpisode?.number}`)}
                    disabled={!prevEpisode}
                    className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-20"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <div className="rounded-2xl border border-[#693def]/20 bg-[#693def]/10 px-5 py-3 text-sm font-black tabular-nums text-[#693def]">
                    {currentEpNum} / {episodeList?.length || "?"}
                  </div>
                  <button
                    onClick={() => navigate(`/watch/${animeSlug}/${nextEpisode?.number}`)}
                    disabled={!nextEpisode}
                    className="flex items-center gap-2 rounded-2xl bg-[#693def] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#8257f2] disabled:opacity-20"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-12 md:grid-cols-[1fr_auto]">
                <div className="max-w-3xl">
                  <div className="mb-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5 rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-3 py-1.5 text-yellow-500">
                      <Star className="h-4 w-4 fill-yellow-500" />
                      <span className="text-sm font-black">{anime.score}</span>
                    </div>
                    <span className="text-[#333333]">|</span>
                    <span className="text-sm font-bold uppercase tracking-widest text-[#777777]">{anime.categoryName}</span>
                    <span className="text-[#333333]">|</span>
                    <span className="text-sm font-bold uppercase tracking-widest text-[#777777]">{anime.releaseYear}</span>
                  </div>
                  <p className="text-lg font-medium leading-relaxed text-[#aaaaaa]" dir="auto">
                    {currentEpisode?.synopsis || anime.synopsis}
                  </p>
                </div>

                <Link to={`/anime/${animeSlug}`} className="group flex flex-col items-center gap-2">
                  <div className="aspect-[2/3] w-32 overflow-hidden rounded-2xl ring-1 ring-white/10 transition-all duration-300 group-hover:ring-[#693def]/40">
                    <AnimeArtwork
                      src={anime.coverImage}
                      alt={anime.title}
                      title={anime.title}
                      className="h-full w-full"
                      imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      fallbackClassName="h-full w-full"
                    />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-[#555555] transition-colors group-hover:text-white">
                    View Details
                  </span>
                </Link>
              </div>
            </div>

            <div className="glass-panel rounded-[2.5rem] p-8">
              <h2 className="mb-8 flex items-center gap-3 text-2xl font-black text-white">
                <div className="h-8 w-2 rounded-full bg-[#693def]" />
                Discussion ({reviews?.length || 0})
              </h2>

              {user && (
                <div className="mb-10 rounded-[2rem] border border-white/10 bg-white/5 p-6">
                  <div className="mb-6 flex items-center gap-4">
                    <span className="text-sm font-black uppercase tracking-widest text-[#555555]">Rate this episode:</span>
                    <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-black/40 px-4 py-2">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={reviewRating}
                        onChange={(event) => setReviewRating(Number(event.target.value))}
                        className="w-32 accent-[#693def]"
                      />
                      <span className="text-lg font-black tabular-nums text-yellow-500">{reviewRating}/10</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={reviewText}
                        onChange={(event) => setReviewText(event.target.value)}
                        placeholder="What did you think of this episode?"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-6 pr-14 font-medium text-white placeholder:text-[#555555] transition focus:border-[#693def] focus:outline-none"
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
                        className="absolute bottom-2 right-2 top-2 flex aspect-square items-center justify-center rounded-xl bg-[#693def] text-white transition hover:bg-[#8257f2] disabled:opacity-20"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {reviews?.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 py-12 text-center">
                    <MessageSquare className="mx-auto mb-3 h-10 w-10 text-[#333333]" />
                    <p className="text-xs font-black uppercase tracking-widest text-[#555555]">No comments yet. Start the conversation.</p>
                  </div>
                ) : (
                  reviews?.map((review) => (
                    <div key={review.id} className="rounded-3xl border border-white/5 bg-white/5 p-6 transition-colors hover:border-white/10">
                      <div className="mb-4 flex items-center gap-4">
                        <img
                          src={review.userAvatar || "/avatars/user1.jpg"}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-black tracking-tight text-white">{review.userName}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#555555]">
                            {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-3 py-1.5 text-yellow-500">
                          <Star className="h-3.5 w-3.5 fill-yellow-500" />
                          <span className="text-xs font-black">{review.rating}</span>
                        </div>
                      </div>
                      <p className="font-medium leading-relaxed text-[#aaaaaa]">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel sticky top-24 rounded-[2.5rem] p-6">
              <div className="mb-8 flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="mb-1 text-lg font-black leading-none tracking-tight text-white">Episodes</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#555555]">{episodeList?.length || 0} Total Titles</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5">
                  <List className="h-5 w-5 text-[#693def]" />
                </div>
              </div>

              <div className="max-h-[calc(100vh-320px)] space-y-3 overflow-y-auto pr-2 scroll-hide">
                {episodeList?.map((episode) => (
                  <button
                    key={episode.id}
                    onClick={() => navigate(`/watch/${animeSlug}/${episode.number}`)}
                    className={`group flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition-all duration-300 ${
                      episode.number === currentEpNum
                        ? "border-[#693def] bg-[#693def] shadow-xl shadow-[#693def]/20"
                        : "border-transparent bg-white/5 hover:border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <div className="relative aspect-video w-24 flex-shrink-0 overflow-hidden rounded-xl">
                      <AnimeArtwork
                        src={episode.thumbnail || anime.coverImage}
                        alt={`EP ${episode.number}`}
                        title={anime.title}
                        className="h-full w-full"
                        imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        fallbackClassName="h-full w-full"
                      />
                      <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${episode.number === currentEpNum ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        <Play className={`h-5 w-5 text-white ${episode.number === currentEpNum ? "fill-white" : ""}`} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`mb-1 text-[10px] font-black uppercase tracking-widest ${
                        episode.number === currentEpNum ? "text-white/80" : "text-[#693def]"
                      }`}>
                        الحلقة {episode.number}
                      </p>
                      <p className={`truncate text-sm font-bold ${
                        episode.number === currentEpNum ? "text-white" : "text-[#dddddd]"
                      }`}>
                        {episode.title || `الحلقة ${episode.number}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
