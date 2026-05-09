import Link from "next/link";
import { AnimeImage } from "../components/AnimeImage";
import { getHomeCatalogData } from "../lib/catalog-source";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { featured, trending } = await getHomeCatalogData();
  const hero = featured[0];

  return (
    <main>
      <section className="section">
        <div className="container hero">
          <div className="hero-copy">
            <div className="eyebrow">Next.js Public Migration</div>
            <h1>{hero?.title ?? "Synx Public Frontend"}</h1>
            <p>
              This Next.js surface is the first public-facing step in the strangler migration. It reads from the existing
              backend while giving us server-rendered metadata, crawler-friendly routes, and a cleaner path to long-term SEO.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href={hero ? `/anime/${hero.slug}` : "/browse"}>
                Open Featured Anime
              </Link>
              <Link className="button" href="/browse">
                Browse Library
              </Link>
            </div>
          </div>

          <div className="hero-card">
            <AnimeImage
              src={hero?.coverImage}
              alt={hero?.title ?? "Featured anime poster"}
              sizes="(min-width: 960px) 33vw, 100vw"
              priority
              frameClassName="hero-media"
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="row" style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0 }}>Featured</h2>
            <span className="muted">{featured.length} titles</span>
          </div>
          <div className="grid anime-grid">
            {featured.map((item) => (
              <Link key={item.id} href={`/anime/${item.slug}`} className="card">
                <AnimeImage
                  src={item.coverImage}
                  alt={item.title}
                  sizes="(min-width: 1180px) 220px, (min-width: 768px) 33vw, 100vw"
                  frameClassName="poster-media"
                />
                <div className="card-copy">
                  <h3>{item.title}</h3>
                  <p className="muted">{item.genreNames || item.categoryName || "No genre"}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="row" style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0 }}>Trending</h2>
            <span className="muted">{trending.length} titles</span>
          </div>
          <div className="grid anime-grid">
            {trending.map((item) => (
              <Link key={item.id} href={`/anime/${item.slug}`} className="card">
                <AnimeImage
                  src={item.coverImage}
                  alt={item.title}
                  sizes="(min-width: 1180px) 220px, (min-width: 768px) 33vw, 100vw"
                  frameClassName="poster-media"
                />
                <div className="card-copy">
                  <h3>{item.title}</h3>
                  <p className="muted">
                    {item.score ? `${item.score} score` : "No score"} | {item.episodesCount ?? 0} episodes
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
