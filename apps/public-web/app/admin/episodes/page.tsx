import Link from "next/link";
import { AdminEpisodeManager } from "../../../components/AdminEpisodeManager";
import { getLegacyApiBaseUrl } from "../../../lib/api";
import { hasDirectAdminAccess } from "../../../lib/admin-auth-source";
import { getCurrentSession } from "../../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Episodes",
  description:
    "Manage imported episode records from the Next.js admin migration surface.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminEpisodesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Admin</div>
            <h1 className="auth-title">Sign in to manage episodes</h1>
            <p className="muted auth-copy">
              The migrated episode manager uses the same administrator session as the rest of the
              Next admin surface.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="button primary">
                Sign In
              </Link>
              <Link href="/admin" className="button">
                Back to admin overview
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (session.role !== "admin") {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Admin</div>
            <h1 className="auth-title">Admin access only</h1>
            <p className="muted auth-copy">
              Episode management is reserved for administrator accounts.
            </p>
            <div className="hero-actions">
              <Link href="/settings" className="button primary">
                Account center
              </Link>
              <Link href="/admin" className="button">
                Back to overview
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!hasDirectAdminAccess()) {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Admin</div>
            <h1 className="auth-title">Direct admin mode is not configured yet</h1>
            <p className="muted auth-copy">
              The Next episode manager needs shared database and session-secret access. Until then,
              keep managing episodes from the legacy admin.
            </p>
            <div className="hero-actions">
              <a href={`${getLegacyApiBaseUrl()}/admin`} className="button primary" rel="noreferrer">
                Open legacy admin
              </a>
              <Link href="/admin" className="button">
                Back to overview
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const resolvedSearchParams = await searchParams;
  const { listAdminEpisodes, adminEpisodeListQuerySchema } = await import(
    "../../../../../api/services/admin-episode-service"
  );
  const query = adminEpisodeListQuerySchema.parse({
    animeId: pickString(resolvedSearchParams.animeId),
    search: pickString(resolvedSearchParams.search),
  });
  const catalog = await listAdminEpisodes(query);

  return (
    <main className="section">
      <div className="container admin-layout">
        <section className="panel watch-copy-panel">
          <div className="eyebrow">Admin Migration</div>
          <div className="watch-heading-row">
            <div>
              <h1 className="watch-title">Episodes</h1>
              <p className="muted auth-copy">
                Create, edit, and delete episode records directly in Next while the last heavy
                bulk-only tools continue to live in the legacy admin.
              </p>
            </div>
            <div className="hero-actions">
              <Link href="/admin" className="button">
                Back to overview
              </Link>
              <Link href="/admin/anime" className="button">
                Anime catalog
              </Link>
              <Link href="/admin/categories" className="button">
                Categories
              </Link>
              <Link href="/admin/reports" className="button">
                Broken reports
              </Link>
              <a href={`${getLegacyApiBaseUrl()}/admin`} className="button" rel="noreferrer">
                Open legacy admin
              </a>
            </div>
          </div>
        </section>

        <section className="panel watch-copy-panel">
          <form className="filter-form" action="/admin/episodes" method="get">
            <select
              aria-label="Filter anime"
              name="animeId"
              defaultValue={catalog.selectedAnimeId ? String(catalog.selectedAnimeId) : ""}
            >
              {catalog.animeOptions.length === 0 ? (
                <option value="">No anime available</option>
              ) : (
                catalog.animeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))
              )}
            </select>
            <input
              aria-label="Search episodes"
              name="search"
              defaultValue={query.search ?? ""}
              placeholder="Search title or number"
            />
            <button type="submit" className="button primary">
              Apply filters
            </button>
          </form>

          <div className="admin-list-row" style={{ marginBottom: 16 }}>
            <div className="muted">
              {catalog.selectedAnime
                ? `Showing ${catalog.total} episodes for ${catalog.selectedAnime.title}`
                : "No anime available yet"}
            </div>
          </div>

          <AdminEpisodeManager
            animeOptions={catalog.animeOptions}
            items={catalog.items}
            selectedAnimeId={catalog.selectedAnimeId}
          />
        </section>
      </div>
    </main>
  );
}
