import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { Play, Plus, Star, TrendingUp, Clock, ChevronRight, type LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AnimeArtwork from "@/components/AnimeArtwork";
import MixedSynopsisText from "@/components/MixedSynopsisText";

function normalizeAnimeSlug(slug?: string | null) {
  return (slug ?? "").replace(/^\/+|\/+$/g, "");
}

/* ─── Bokeh Particle System ─── */
// Kept for future hero experiments; currently disabled for performance.
function BokehLayer({ count, minSize, maxSize, speed, colorClass }: {
  count: number; minSize: number; maxSize: number; speed: number; colorClass: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationEnabledRef = useRef(true);
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number; size: number; opacity: number;
    pulseSpeed: number; pulseOffset: number;
  }>>([]);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compactLayout = window.innerWidth < 1024;
    animationEnabledRef.current = !reducedMotion && !compactLayout;
    if (!animationEnabledRef.current) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Array<{
      x: number; y: number; vx: number; vy: number; size: number; opacity: number;
      pulseSpeed: number; pulseOffset: number;
    }> = [];
    for (let i = 0; i < count; i++) {
      const size = minSize + Math.random() * (maxSize - minSize);
      particles.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed * 0.5,
        size,
        opacity: 0.3 + Math.random() * 0.4,
        pulseSpeed: 0.005 + Math.random() * 0.01,
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });

    const startTime = performance.now();
    const render = (currentTime: number) => {
      const time = currentTime - startTime;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const mouseX = (mouseRef.current.x - 0.5) * 2;

      particles.forEach((p) => {
        p.x += p.vx + mouseX * speed * 0.5;
        p.y += p.vy;

        if (p.x < -10) p.x = 110;
        if (p.x > 110) p.x = -10;
        if (p.y < -10) p.y = 110;
        if (p.y > 110) p.y = -10;

        const pulse = Math.sin(time * p.pulseSpeed + p.pulseOffset);
        const currentOpacity = p.opacity + pulse * 0.1;

        const gradient = ctx.createRadialGradient(
          (p.x / 100) * w, (p.y / 100) * h, 0,
          (p.x / 100) * w, (p.y / 100) * h, p.size / 2
        );

        if (colorClass === "violet") {
          gradient.addColorStop(0, `rgba(130, 87, 242, ${currentOpacity * 0.8})`);
          gradient.addColorStop(0.5, `rgba(105, 61, 239, ${currentOpacity * 0.3})`);
        } else if (colorClass === "purple") {
          gradient.addColorStop(0, `rgba(150, 80, 200, ${currentOpacity * 0.6})`);
          gradient.addColorStop(0.5, `rgba(100, 50, 180, ${currentOpacity * 0.2})`);
        } else {
          gradient.addColorStop(0, `rgba(80, 100, 255, ${currentOpacity * 0.5})`);
          gradient.addColorStop(0.5, `rgba(60, 70, 200, ${currentOpacity * 0.15})`);
        }
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.beginPath();
        ctx.arc((p.x / 100) * w, (p.y / 100) * h, p.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, [count, minSize, maxSize, speed, colorClass]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ filter: "blur(26px)" }}
    />
  );
}

/* ─── Hero Section ─── */
function HeroSection() {
  const { data: featured } = trpc.anime.featured.useQuery();
  const heroAnime = featured?.[0];
  const showHeroBokeh = Boolean(import.meta.env.VITE_ENABLE_HERO_BOKEH);

  return (
    <section className="relative w-full min-h-[100dvh] flex items-center justify-center overflow-hidden bg-[#030209]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(105,61,239,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(9,7,17,0.96),rgba(3,2,9,1))]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#693def]/10 to-transparent" />
      {showHeroBokeh ? <BokehLayer count={8} minSize={80} maxSize={220} speed={0.012} colorClass="violet" /> : null}
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-24 pb-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 mb-8">
              <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#693def]/20 to-[#8257f2]/10 text-[#a78bfa] text-xs font-bold border border-[#693def]/30 tracking-wider shadow-[0_0_20px_rgba(105,61,239,0.15)]">
                FEATURED
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-bold text-white leading-none">
                  {heroAnime?.score ?? "9.2"}
                </span>
              </div>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.1] tracking-tight mb-6 bg-clip-text">
              {heroAnime?.title ?? "The Next Evolution"}
            </h1>

            {((heroAnime?.titleEnglish && heroAnime.titleEnglish !== heroAnime.title) || (heroAnime?.titleJp && heroAnime.titleJp !== heroAnime.title)) && (
              <p className="text-xl text-[#8257f2] font-semibold mb-6 tracking-wide">
                {heroAnime?.titleEnglish && heroAnime.titleEnglish !== heroAnime.title ? heroAnime.titleEnglish : heroAnime?.titleJp}
              </p>
            )}

            <MixedSynopsisText className="mb-10 max-w-xl text-lg font-medium leading-relaxed text-[#bbbbbb] sm:text-xl">
              {heroAnime?.synopsis ??
                "Experience the new season of groundbreaking anime. Discover worlds beyond imagination."}
            </MixedSynopsisText>

            <div className="flex flex-wrap gap-5">
              <Link
                to={heroAnime ? `/watch/${normalizeAnimeSlug(heroAnime.slug)}/1` : "/browse"}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-[#693def] to-[#8257f2] text-white font-bold transition-all duration-500 ease-out hover:scale-105 hover:shadow-[0_20px_50px_rgba(105,61,239,0.5)] violet-glow group"
              >
                <Play className="w-5 h-5 fill-white transition-transform duration-300 group-hover:scale-110" />
                Watch Now
              </Link>
              <Link
                to={heroAnime ? `/anime/${normalizeAnimeSlug(heroAnime.slug)}` : "/browse"}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full border-2 border-white/10 text-white font-bold hover:bg-white/5 hover:border-white/20 transition-all duration-500 ease-out hover:scale-105 group"
              >
                <Plus className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" />
                More Info
              </Link>
            </div>
          </motion.div>

          {/* Right: Character Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className="hidden lg:flex justify-center items-center"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-[3rem] bg-[radial-gradient(circle,rgba(105,61,239,0.2),transparent_60%)] blur-2xl" />
              <img
                src="/hero-character.png"
                alt="Hero Character"
                className="relative z-10 h-auto w-full max-w-[500px] rounded-[3rem] object-contain drop-shadow-[0_20px_50px_rgba(105,61,239,0.24)]"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030209] to-transparent z-[5]" />
    </section>
  );
}

/* ─── Anime Card ─── */
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
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/anime/${normalizeAnimeSlug(anime.slug)}`} className="group block">
        <div className="relative aspect-[16/10] rounded-[2rem] overflow-hidden mb-4 shadow-lg border border-white/5 transition-all duration-500 ease-out group-hover:shadow-[0_20px_50px_rgba(105,61,239,0.2)] group-hover:border-white/10 group-hover:-translate-y-1">
          <AnimeArtwork
            src={anime.coverImage}
            alt={anime.title}
            title={anime.title}
            className="w-full h-full rounded-[2rem]"
            imageClassName="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 rounded-[2rem]"
            fallbackClassName="w-full h-full transition-all duration-700 ease-out group-hover:scale-110 rounded-[2rem]"
          />
          <div className="absolute inset-0 card-overlay opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/10 tracking-wider shadow-lg">
            EP {anime.episodesCount || "?"}
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out scale-90 group-hover:scale-100">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#693def] to-[#8257f2] flex items-center justify-center backdrop-blur-md shadow-[0_0_30px_rgba(105,61,239,0.6)] transition-transform duration-300 group-hover:scale-110">
              <Play className="w-6 h-6 text-white fill-white ml-1" />
            </div>
          </div>
        </div>
        <h3 className="text-[15px] font-bold text-white truncate group-hover:text-[#8257f2] transition-colors duration-300 px-0.5">
          {anime.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 px-0.5">
          <span className="text-[11px] font-medium text-[#777777] uppercase tracking-wider">{anime.genreNames || anime.categoryName}</span>
          <span className="text-[#333333]">/</span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-yellow-500">
            <Star className="w-3 h-3 fill-yellow-500" />
            {anime.score}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: LucideIcon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mb-10"
    >
      <div className="flex items-center gap-4 mb-3">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#693def]/15 to-[#8257f2]/5 border border-[#693def]/20 shadow-[0_0_20px_rgba(105,61,239,0.1)]">
            <Icon className="w-5 h-5 text-[#693def]" />
          </div>
        )}
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none">{title}</h2>
      </div>
      {subtitle && <p className="text-base text-[#777777] font-medium ml-1">{subtitle}</p>}
    </motion.div>
  );
}

/* ─── Trending Section ─── */
function TrendingSection() {
  const { data: trending } = trpc.anime.trending.useQuery();

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <SectionHeader
        title="Trending Now"
        subtitle="The most watched anime this week"
        icon={TrendingUp}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
        {trending?.map((a, i) => (
          <AnimeCard key={a.id} anime={a} index={i} />
        ))}
      </div>
    </section>
  );
}

/* ─── Featured Section ─── */
function FeaturedSection() {
  const { data: featured } = trpc.anime.featured.useQuery();
  const displayFeatured = featured?.slice(1, 5) || [];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-gradient-to-b from-transparent via-[#693def]/5 to-transparent rounded-[3rem]">
      <SectionHeader
        title="Featured This Season"
        subtitle="Hand-picked anime you can't miss"
        icon={Star}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {displayFeatured.map((a, i) => (
          <AnimeCard key={a.id} anime={a} index={i} />
        ))}
      </div>
    </section>
  );
}

/* ─── Reviews Section ─── */
const mockReviews = [
  {
    id: 1,
    userName: "Kaito",
    userAvatar: "/avatars/user1.jpg",
    animeTitle: "Neon Genesis: Eclipse",
    rating: 9,
    comment: "Absolutely mind-blowing animation and story. The mecha designs are some of the best I've seen in years. Every episode leaves you wanting more.",
  },
  {
    id: 2,
    userName: "Sakura",
    userAvatar: "/avatars/user2.jpg",
    animeTitle: "Moonlit Garden",
    rating: 10,
    comment: "A beautiful masterpiece that captures the essence of romance and fantasy. The art direction is simply stunning. I cried at the ending.",
  },
  {
    id: 3,
    userName: "Ren",
    userAvatar: "/avatars/user3.jpg",
    animeTitle: "Cyberpulse: Reboot",
    rating: 8,
    comment: "Great cyberpunk atmosphere with solid worldbuilding. The hacker protagonist is so relatable. Can't wait for season 2!",
  },
  {
    id: 4,
    userName: "Mika",
    userAvatar: "/avatars/user4.jpg",
    animeTitle: "Crimson Blade Chronicles",
    rating: 9,
    comment: "The fight choreography is incredible. Each battle feels weighty and meaningful. The crimson blade concept is brilliantly executed.",
  },
];

function ReviewsSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section className="py-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <SectionHeader
          title="Community Reviews"
          subtitle="What our viewers are saying"
          icon={ChevronRight}
        />
      </div>

      <div ref={containerRef} className="relative">
        <div className="flex gap-6 animate-scroll-left hover:[animation-play-state:paused] px-4">
          {[...mockReviews, ...mockReviews].map((review, i) => (
            <div
              key={`${review.id}-${i}`}
              className="flex-shrink-0 w-[380px] glass-panel p-6 transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(105,61,239,0.15)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={review.userAvatar}
                  alt={review.userName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{review.userName}</p>
                  <p className="text-xs text-[#888888]">{review.animeTitle}</p>
                </div>
                <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border border-yellow-500/20">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs font-bold text-yellow-400">{review.rating}</span>
                </div>
              </div>
              <p className="text-sm text-[#cccccc] leading-relaxed">{review.comment}</p>
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
      `}</style>
    </section>
  );
}

/* ─── Categories Section ─── */
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
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <SectionHeader
        title="Browse by Genre"
        subtitle="Find your next favorite anime"
        icon={Clock}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {categories?.map((cat, i) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to={`/browse?category=${cat.slug}`}
              className={`group relative block p-6 rounded-[2.5rem] overflow-hidden bg-gradient-to-br ${
                categoryColors[cat.slug] || "from-[#693def]/25 to-[#8257f2]/20"
              } border border-white/5 hover:border-[#693def]/40 transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(105,61,239,0.2)]`}
            >
              <div className="relative z-10 text-center">
                <h3 className="text-base font-black text-white transition-colors tracking-tight group-hover:scale-105 transition-transform duration-300">
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="text-[11px] text-[#aaaaaa] mt-1.5 line-clamp-1 font-medium">{cat.description}</p>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-500" />
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ─── Home Page ─── */
export default function Home() {
  return (
    <div className="bg-[#030209] min-h-screen">
      <HeroSection />
      <TrendingSection />
      <FeaturedSection />
      <CategoriesSection />
      <ReviewsSection />
    </div>
  );
}
