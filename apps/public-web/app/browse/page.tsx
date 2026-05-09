import Link from "next/link";
import { AnimeImage } from "../../components/AnimeImage";
import { getBrowseCatalogData } from "../../lib/catalog-source";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Browse Anime",
  description:
    "Server-rendered browse view powered by shared Synx catalog services during migration.",
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const data = await getBrowseCatalogData(resolvedSearchParams);

  return (
    <main className="section">
      <div className="container">
        <div className="panel" style={{ borderRadius: 28, padding: 24, marginBottom: 24 }}>
          <h1 style={{ marginTop: 0 }}>Browse</h1>
          <p className="muted">
            This server-rendered browse page now prefers shared catalog services
            directly, while the legacy app still owns admin and mutation flows.
          </p>
          <form className="filter-form" action="/browse">
            <input name="search" defaultValue={String(resolvedSearchParams.search ?? "")} placeholder="Search title or genre" />
            <select name="status" defaultValue={String(resolvedSearchParams.status ?? "")}>
              <option value="">Any status</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="upcoming">Upcoming</option>
            </select>
            <select name="type" defaultValue={String(resolvedSearchParams.type ?? "")}>
              <option value="">Any type</option>
              <option value="tv">TV</option>
              <option value="movie">Movie</option>
              <option value="ova">OVA</option>
              <option value="special">Special</option>
            </select>
            <button className="button primary" type="submit">
              Apply Filters
            </button>
          </form>
          <p className="muted" style={{ marginBottom: 0 }}>
            {data.total} result(s) | page {data.page}
          </p>
        </div>

        <div className="grid anime-grid">
          {data.items.map((item) => (
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
    </main>
  );
}
