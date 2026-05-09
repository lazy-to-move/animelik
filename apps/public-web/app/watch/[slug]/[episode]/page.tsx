import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimeImage } from "../../../../components/AnimeImage";
import { BrokenEpisodeReportCard } from "../../../../components/BrokenEpisodeReportCard";
import { WatchProgressPanel } from "../../../../components/WatchProgressPanel";
import { WatchPlayer } from "../../../../components/WatchPlayer";
import {
  getPublicSiteUrl,
  resolveMediaUrl,
} from "../../../../lib/api";
import { getAnimeCatalogDetail } from "../../../../lib/catalog-source";
import {
  getCurrentSession,
  getCurrentWatchlist,
} from "../../../../lib/server-api";

export const dynamic = "force-dynamic";

function normalizeEpisodeNumber(rawEpisode: string) {
  const parsed = Number.parseInt(rawEpisode, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}): Promise<Metadata> {
  const { slug, episode } = await params;
  const episodeNumber = normalizeEpisodeNumber(episode);

  if (!episodeNumber) {
    return { title: "Episode Not Found" };
  }

  try {
    const data = await getAnimeCatalogDetail(slug);
    const currentEpisode = data.episodes.find(
      (item) => item.number === episodeNumber,
    );
    if (!currentEpisode) {
      return { title: "Episode Not Found" };
    }

    const title = `${data.anime.title} Episode ${episodeNumber}`;
    const description =
      currentEpisode.synopsis?.slice(0, 160) ||
      data.anime.synopsis?.slice(0, 160) ||
      "Watch page served by the Next.js migration surface.";
    const previewImage = resolveMediaUrl(
      currentEpisode.thumbnail ??
        data.anime.bannerImage ??
        data.anime.coverImage,
    );
    const canonicalUrl = `${getPublicSiteUrl()}/watch/${encodeURIComponent(slug)}/${episodeNumber}`;

    return {
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title,
        description,
        type: "video.episode",
        url: canonicalUrl,
        images: previewImage
          ? [{ url: previewImage, alt: title }]
          : [],
      },
    };
  } catch {
    return { title: "Episode Not Found" };
  }
}

export default async function WatchEpisodePage({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = await params;
  const episodeNumber = normalizeEpisodeNumber(episode);

  if (!episodeNumber) {
    notFound();
  }

  let data;
  try {
    data = await getAnimeCatalogDetail(slug);
  } catch {
    notFound();
  }

  const currentEpisode = data.episodes.find(
    (item) => item.number === episodeNumber,
  );

  if (!currentEpisode) {
    notFound();
  }

  const episodeTitle =
    currentEpisode.title || `Episode ${currentEpisode.number}`;
  const prevEpisode = data.episodes.find(
    (item) => item.number === currentEpisode.number - 1,
  );
  const nextEpisode = data.episodes.find(
    (item) => item.number === currentEpisode.number + 1,
  );
  const session = await getCurrentSession();
  const watchlistItems = session ? await getCurrentWatchlist() : null;
  const currentWatchlistItem =
    watchlistItems?.find((item) => item.animeId === data.anime.id) ?? null;

  return (
    <main className="section">
      <div className="container watch-layout">
        <section className="watch-main">
          <div className="panel watch-copy-panel">
            <p className="eyebrow">Watch</p>
            <div className="watch-heading-row">
              <div>
                <h1 className="watch-title">{data.anime.title}</h1>
                <p className="watch-subtitle">{episodeTitle}</p>
              </div>
              <Link className="button" href={`/anime/${data.anime.slug}`}>
                Back to anime
              </Link>
            </div>

            <div className="watch-episode-nav">
              {prevEpisode ? (
                <Link
                  className="button"
                  href={`/watch/${data.anime.slug}/${prevEpisode.number}`}
                >
                  Previous episode
                </Link>
              ) : (
                <span className="button disabled" aria-disabled="true">
                  Previous episode
                </span>
              )}

              {nextEpisode ? (
                <Link
                  className="button primary"
                  href={`/watch/${data.anime.slug}/${nextEpisode.number}`}
                >
                  Next episode
                </Link>
              ) : (
                <span className="button disabled" aria-disabled="true">
                  Next episode
                </span>
              )}
            </div>
          </div>

          <WatchPlayer
            animeTitle={data.anime.title}
            episodeTitle={episodeTitle}
            fallbackPoster={
              currentEpisode.thumbnail ?? data.anime.coverImage ?? null
            }
            videoUrl={currentEpisode.videoUrl}
            videoSources={currentEpisode.videoSources}
          />

          <WatchProgressPanel
            animeId={data.anime.id}
            episodeNumber={currentEpisode.number}
            initialItem={currentWatchlistItem}
            isSignedIn={Boolean(session)}
          />

          <BrokenEpisodeReportCard
            episodeId={currentEpisode.id}
            episodeNumber={currentEpisode.number}
            isSignedIn={Boolean(session)}
          />

          <div className="panel watch-copy-panel">
            <h2 style={{ marginTop: 0 }}>Episode overview</h2>
            <p className="muted">
              {currentEpisode.synopsis || data.anime.synopsis}
            </p>
          </div>
        </section>

        <aside className="watch-sidebar">
          <div className="hero-card">
            <AnimeImage
              src={data.anime.coverImage}
              alt={data.anime.title}
              sizes="(min-width: 1200px) 320px, 100vw"
              frameClassName="detail-media"
            />
          </div>

          <div className="panel watch-copy-panel">
            <h2 style={{ marginTop: 0 }}>All episodes</h2>
            <div className="watch-episode-list">
              {data.episodes.map((item) => (
                <Link
                  key={item.id}
                  href={`/watch/${data.anime.slug}/${item.number}`}
                  className={`watch-episode-link${
                    item.id === currentEpisode.id ? " active" : ""
                  }`}
                >
                  <strong>Episode {item.number}</strong>
                  <span className="muted">
                    {item.title || `Episode ${item.number}`}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
