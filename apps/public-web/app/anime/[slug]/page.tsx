import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimeImage } from "../../../components/AnimeImage";
import { ReviewSection } from "../../../components/ReviewSection";
import { WatchlistAction } from "../../../components/WatchlistAction";
import { getPublicSiteUrl, resolveMediaUrl } from "../../../lib/api";
import { getAnimeCatalogDetail } from "../../../lib/catalog-source";
import { getCurrentSession, getCurrentWatchlist } from "../../../lib/server-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const data = await getAnimeCatalogDetail(slug);
    const previewImage = resolveMediaUrl(data.anime.bannerImage ?? data.anime.coverImage);
    const description =
      data.anime.synopsis?.slice(0, 160) ||
      "Anime detail page served by the Next.js migration surface.";

    return {
      title: data.anime.title,
      description,
      alternates: {
        canonical: `${getPublicSiteUrl()}/anime/${encodeURIComponent(slug)}`,
      },
      openGraph: {
        title: data.anime.title,
        description,
        type: "website",
        url: `${getPublicSiteUrl()}/anime/${encodeURIComponent(slug)}`,
        images: previewImage
          ? [
              {
                url: previewImage,
                alt: data.anime.title,
              },
            ]
          : [],
      },
    };
  } catch {
    return {
      title: "Anime Not Found",
    };
  }
}

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data;
  try {
    data = await getAnimeCatalogDetail(slug);
  } catch {
    notFound();
  }

  const { anime, episodes, reviews } = data;
  const session = await getCurrentSession();
  const watchlistItems = session ? await getCurrentWatchlist() : null;
  const currentWatchlistItem =
    watchlistItems?.find((item) => item.animeId === anime.id) ?? null;

  return (
    <main className="section">
      <div className="container detail-layout">
        <aside>
          <div className="hero-card">
            <AnimeImage
              src={anime.coverImage}
              alt={anime.title}
              sizes="(min-width: 960px) 320px, 100vw"
              priority
              frameClassName="detail-media"
            />
          </div>
        </aside>

        <section>
          <div className="eyebrow">Anime Detail</div>
          <h1 style={{ marginTop: 0, fontSize: "clamp(2.4rem, 5vw, 4rem)", lineHeight: 0.95 }}>{anime.title}</h1>
          {anime.titleEnglish && anime.titleEnglish !== anime.title && (
            <p style={{ color: "#9d7cff", fontWeight: 700 }}>{anime.titleEnglish}</p>
          )}
          <div className="detail-meta" style={{ marginBottom: 20 }}>
            {anime.status && <span className="pill">{anime.status}</span>}
            {anime.type && <span className="pill">{anime.type}</span>}
            {anime.score && <span className="pill">{anime.score} score</span>}
            {anime.episodesCount !== null && <span className="pill">{anime.episodesCount} episodes</span>}
          </div>
          <p className="muted" style={{ fontSize: "1rem" }}>{anime.synopsis}</p>

          <WatchlistAction
            animeId={anime.id}
            initialItem={currentWatchlistItem}
            isSignedIn={Boolean(session)}
          />

          <div className="panel" style={{ borderRadius: 28, padding: 24, marginTop: 28 }}>
            <h2 style={{ marginTop: 0 }}>Episodes</h2>
            <div className="episode-list">
              {episodes.map((episode) => (
                <Link
                  key={episode.id}
                  href={`/watch/${anime.slug}/${episode.number}`}
                  className="episode-item"
                >
                  <strong>Episode {episode.number}</strong>
                  <div className="muted">{episode.title || `Episode ${episode.number}`}</div>
                </Link>
              ))}
            </div>
          </div>

          <ReviewSection
            animeId={anime.id}
            initialReviews={reviews}
            isSignedIn={Boolean(session)}
            currentUserId={session?.id ?? null}
            currentUserRole={session?.role ?? null}
          />
        </section>
      </div>
    </main>
  );
}
