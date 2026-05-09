import { Link } from "react-router";
import { Play, Plus, Star, TrendingUp, Clock, ChevronRight, type LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AnimeArtwork from "@/components/AnimeArtwork";
import MixedSynopsisText from "@/components/MixedSynopsisText";
import Reveal from "@/components/Reveal";

function normalizeAnimeSlug(slug?: string | null) {
  return (slug ?? "").replace(/^\/+|\/+$/g, "");
}

function HeroSection() {
  const { data: featured } = trpc.anime.featured.useQuery();
  const heroAnime = featured?.[0];

  return (
    <section className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#030209]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(105,61,239,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(9,7,17,0.96),rgba(3,2,9,1))]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#693def]/10 to-transparent" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-12 pt-24 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal direction="left">
            <div className="mb-8 flex items-center gap-3">
              <span className="rounded-full border border-[#693def]/30 bg-gradient-to-r from-[#693def]/20 to-[#8257f2]/10 px-3.5 py-1.5 text-xs font-bold tracking-wider text-[#a78bfa] shadow-[0_0_20px_rgba(105,61,239,0.15)]">
                FEATURED
              </span>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-bold leading-none text-white">{heroAnime?.score ?? "9.2"}</span>
              </div>
            </div>

            <h1 className="mb-6 bg-clip-text text-5xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
              {heroAnime?.title ?? "The Next Evolution"}
            </h1>

            {((heroAnime?.titleEnglish && heroAnime.titleEnglish !== heroAnime.title) ||
              (heroAnime?.titleJp && heroAnime.titleJp !== heroAnime.title)) && (
              <p className="mb-6 text-xl font-semibold tracking-wide text-[#8257f2]">
                {heroAnime?.titleEnglish && heroAnime.titleEnglish !== heroAnime.title
                  ? heroAnime.titleEnglish
                  : heroAnime?.titleJp}
              </p>
            )}

            <MixedSynopsisText className="mb-10 max-w-xl text-lg font-medium leading-relaxed text-[#bbbbbb] sm:text-xl">
              {heroAnime?.synopsis ??
                "Experience the new season of groundbreaking anime. Discover worlds beyond imagination."}
            </MixedSynopsisText>

            <div className="flex flex-wrap gap-5">
              <Link
                to={heroAnime ? `/watch/${normalizeAnimeSlug(heroAnime.slug)}/1` : "/browse"}
                className="group violet-glow inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#693def] to-[#8257f2] px-8 py-4 font-bold text-white transition-all duration-500 ease-out hover:scale-105 hover:shadow-[0_20px_50px_rgba(105,61,239,0.5)]"
              >
                <Play className="h-5 w-5 fill-white transition-transform duration-300 group-hover:scale-110" />
                Watch Now
              </Link>
              <Link
                to={heroAnime ? `/anime/${normalizeAnimeSlug(heroAnime.slug)}` : "/browse"}
                className="group inline-flex items-center gap-3 rounded-full border-2 border-white/10 px-8 py-4 font-bold text-white transition-all duration-500 ease-out hover:scale-105 hover:border-white/20 hover:bg-white/5"
              >
                <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
                More Info
              </Link>
            </div>
          </Reveal>

          <Reveal direction="scale" delayMs={120} className="hidden items-center justify-center lg:flex">
            <div className="relative">
              <div className="absolute inset-0 rounded-[3rem] bg-[radial-gradient(circle,rgba(105,61,239,0.2),transparent_60%)] blur-2xl" />
              <img
                src="/hero-character.png"
                alt="Hero Character"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="relative z-10 h-auto w-full max-w-[500px] rounded-[3rem] object-contain drop-shadow-[0_20px_50px_rgba(105,61,239,0.24)]"
              />
            </div>
          </Reveal>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[5] h-32 bg-gradient-to-t from-[#030209] to-transparent" />
    </section>
  );
}

type HomeAnimeCardItem = {
  slug: string;
  coverImage?: string | null;
  title: string;
  genreNames?: string;
  categoryName?: string;
  score?: string | null;
  episodesCount?: number | null;
};

function AnimeCard({ anime, index }: { anime: HomeAnimeCardItem; index: number }) {
  return (
    <Reveal direction="up" delayMs={index * 60}>
      <Link to={`/anime/${normalizeAnimeSlug(anime.slug)}`} className="group block">
        <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-[2rem] border border-white/5 shadow-lg transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:border-white/10 group-hover:shadow-[0_20px_50px_rgba(105,61,239,0.2)]">
          <AnimeArtwork
            src={anime.coverImage}
            alt={anime.title}
            title={anime.title}
            className="h-full w-full rounded-[2rem]"
            imageClassName="h-full w-full rounded-[2rem] object-cover transition-all duration-700 ease-out group-hover:scale-110"
            fallbackClassName="h-full w-full rounded-[2rem] transition-all duration-700 ease-out group-hover:scale-110"
          />
          <div className="card-overlay absolute inset-0 opacity-40 transition-opacity duration-500 group-hover:opacity-70" />
          <div className="absolute right-3 top-3 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white shadow-lg backdrop-blur-md">
            EP {anime.episodesCount || "?"}
          </div>
          <div className="absolute inset-0 flex scale-90 items-center justify-center opacity-0 transition-all duration-500 ease-out group-hover:scale-100 group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#693def] to-[#8257f2] shadow-[0_0_30px_rgba(105,61,239,0.6)] backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
              <Play className="ml-1 h-6 w-6 fill-white text-white" />
            </div>
          </div>
        </div>
        <h3 className="truncate px-0.5 text-[15px] font-bold text-white transition-colors duration-300 group-hover:text-[#8257f2]">
          {anime.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-2 px-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#777777]">
            {anime.genreNames || anime.categoryName}
          </span>
          <span className="text-[#333333]">/</span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-yellow-500">
            <Star className="h-3 w-3 fill-yellow-500" />
            {anime.score}
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: LucideIcon }) {
  return (
    <Reveal className="mb-10">
      <div className="mb-3 flex items-center gap-4">
        {Icon && (
          <div className="rounded-xl border border-[#693def]/20 bg-gradient-to-br from-[#693def]/15 to-[#8257f2]/5 p-2.5 shadow-[0_0_20px_rgba(105,61,239,0.1)]">
            <Icon className="h-5 w-5 text-[#693def]" />
          </div>
        )}
        <h2 className="text-3xl font-black leading-none tracking-tight text-white sm:text-4xl">{title}</h2>
      </div>
      {subtitle && <p className="ml-1 text-base font-medium text-[#777777]">{subtitle}</p>}
    </Reveal>
  );
}

function TrendingSection() {
  const { data: trending } = trpc.anime.trending.useQuery();

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8" style={{ contentVisibility: "auto" }}>
      <SectionHeader title="Trending Now" subtitle="The most watched anime this week" icon={TrendingUp} />
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-8 lg:grid-cols-4">
        {trending?.map((anime, index) => (
          <AnimeCard key={anime.id} anime={anime} index={index} />
        ))}
      </div>
    </section>
  );
}

function FeaturedSection() {
  const { data: featured } = trpc.anime.featured.useQuery();
  const displayFeatured = featured?.slice(1, 5) || [];

  return (
    <section
      className="mx-auto max-w-7xl rounded-[3rem] bg-gradient-to-b from-transparent via-[#693def]/5 to-transparent px-4 py-24 sm:px-6 lg:px-8"
      style={{ contentVisibility: "auto" }}
    >
      <SectionHeader title="Featured This Season" subtitle="Hand-picked anime you can't miss" icon={Star} />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
        {displayFeatured.map((anime, index) => (
          <AnimeCard key={anime.id} anime={anime} index={index} />
        ))}
      </div>
    </section>
  );
}

const mockReviews = [
  {
    id: 1,
    userName: "Kaito",
    userAvatar: "/avatars/user1.jpg",
    animeTitle: "Neon Genesis: Eclipse",
    rating: 9,
    comment:
      "Absolutely mind-blowing animation and story. The mecha designs are some of the best I've seen in years. Every episode leaves you wanting more.",
  },
  {
    id: 2,
    userName: "Sakura",
    userAvatar: "/avatars/user2.jpg",
    animeTitle: "Moonlit Garden",
    rating: 10,
    comment:
      "A beautiful masterpiece that captures the essence of romance and fantasy. The art direction is simply stunning. I cried at the ending.",
  },
  {
    id: 3,
    userName: "Ren",
    userAvatar: "/avatars/user3.jpg",
    animeTitle: "Cyberpulse: Reboot",
    rating: 8,
    comment:
      "Great cyberpunk atmosphere with solid worldbuilding. The hacker protagonist is so relatable. Can't wait for season 2!",
  },
  {
    id: 4,
    userName: "Mika",
    userAvatar: "/avatars/user4.jpg",
    animeTitle: "Crimson Blade Chronicles",
    rating: 9,
    comment:
      "The fight choreography is incredible. Each battle feels weighty and meaningful. The crimson blade concept is brilliantly executed.",
  },
];

function ReviewsSection() {
  return (
    <section className="overflow-hidden py-20" style={{ contentVisibility: "auto" }}>
      <div className="mx-auto mb-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Community Reviews" subtitle="What our viewers are saying" icon={ChevronRight} />
      </div>

      <div className="relative">
        <div className="animate-scroll-left flex gap-6 px-4 hover:[animation-play-state:paused]">
          {[...mockReviews, ...mockReviews].map((review, index) => (
            <div
              key={`${review.id}-${index}`}
              className="glass-panel w-[380px] flex-shrink-0 p-6 transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(105,61,239,0.15)]"
            >
              <div className="mb-4 flex items-center gap-3">
                <img
                  src={review.userAvatar}
                  alt={`${review.userName} avatar`}
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{review.userName}</p>
                  <p className="text-xs text-[#888888]">{review.animeTitle}</p>
                </div>
                <div className="ml-auto flex items-center gap-1 rounded-lg border border-yellow-500/20 bg-gradient-to-r from-yellow-500/20 to-orange-500/10 px-2.5 py-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-bold text-yellow-400">{review.rating}</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[#cccccc]">{review.comment}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll-left {
          animation: scroll-left 40s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-scroll-left {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}

function CategoriesSection() {
  const { data: categories } = trpc.category.list.useQuery();

  const categoryColors: Record<string, string> = {
    action: "from-red-500/25 to-orange-600/20",
    adventure: "from-emerald-500/25 to-teal-600/20",
    fantasy: "from-violet-500/25 to-purple-600/20",
    "sci-fi": "from-cyan-500/25 to-blue-600/20",
    romance: "from-pink-500/25 to-rose-600/20",
    horror: "from-gray-600/25 to-slate-700/20",
    comedy: "from-yellow-500/25 to-amber-600/20",
    drama: "from-indigo-500/25 to-violet-600/20",
    mystery: "from-blue-500/25 to-indigo-600/20",
    sports: "from-orange-500/25 to-red-600/20",
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8" style={{ contentVisibility: "auto" }}>
      <SectionHeader title="Browse by Genre" subtitle="Find your next favorite anime" icon={Clock} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {categories?.map((category, index) => (
          <Reveal key={category.id} direction="scale" delayMs={index * 40}>
            <Link
              to={`/browse?category=${category.slug}`}
              className={`group relative block overflow-hidden rounded-[2.5rem] border border-white/5 bg-gradient-to-br ${
                categoryColors[category.slug] || "from-[#693def]/25 to-[#8257f2]/20"
              } p-6 transition-all duration-500 ease-out hover:-translate-y-1 hover:border-[#693def]/40 hover:shadow-[0_20px_40px_rgba(105,61,239,0.2)]`}
            >
              <div className="relative z-10 text-center">
                <h3 className="text-base font-black tracking-tight text-white transition-transform duration-300 group-hover:scale-105">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="mt-1.5 line-clamp-1 text-[11px] font-medium text-[#aaaaaa]">{category.description}</p>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="absolute inset-0 bg-white/0 transition-colors duration-500 group-hover:bg-white/5" />
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#030209]">
      <HeroSection />
      <TrendingSection />
      <FeaturedSection />
      <CategoriesSection />
      <ReviewsSection />
    </div>
  );
}
