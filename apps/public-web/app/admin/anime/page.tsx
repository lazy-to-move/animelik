import Link from "next/link";
import { AdminAnimeCatalog } from "../../../components/AdminAnimeCatalog";
import { getLegacyApiBaseUrl } from "../../../lib/api";
import { hasDirectAdminAccess } from "../../../lib/admin-auth-source";
import { getCurrentSession } from "../../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Anime Catalog",
  description:
    "Manage imported anime records from the Next.js admin migration surface.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPaginationHref(
  page: number,
  currentParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  const search = pickString(currentParams.search);
  const status = pickString(currentParams.status);
  const sourceSite = pickString(currentParams.sourceSite);

  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (sourceSite) params.set("sourceSite", sourceSite);
  params.set("page", String(page));

  return `/admin/anime?${params.toString()}`;
}

export default async function AdminAnimePage({
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
            <h1 className="auth-title">Sign in to manage the anime catalog</h1>
            <p className="muted auth-copy">
              The migrated admin catalog lives behind the same administrator session as the rest of
              the Next admin surface.
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
              Your current account can browse the public migration pages, but anime catalog
              management is reserved for administrators.
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
              The Next anime catalog needs shared database and session-secret access. Until then,
              keep managing titles from the legacy admin.
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
  const [
    { listAdminAnimePage, adminAnimeListQuerySchema },
    { listAdminScraperSources },
  ] = await Promise.all([
    import("../../../../../api/services/admin-anime-service"),
    import("../../../../../api/services/admin-scraper-read-service"),
  ]);

  const parsedQuery = adminAnimeListQuerySchema.parse({
    search: pickString(resolvedSearchParams.search),
    status: pickString(resolvedSearchParams.status),
    sourceSite: pickString(resolvedSearchParams.sourceSite),
    page: pickString(resolvedSearchParams.page)
      ? Number.parseInt(pickString(resolvedSearchParams.page) as string, 10)
      : undefined,
  });
  const [catalog, sources] = await Promise.all([
    listAdminAnimePage(parsedQuery),
    Promise.resolve(listAdminScraperSources()),
  ]);

  return (
    <main className="section">
      <div className="container admin-layout">
        <section className="panel watch-copy-panel">
          <div className="eyebrow">Admin Migration</div>
          <div className="watch-heading-row">
            <div>
              <h1 className="watch-title">Anime catalog</h1>
              <p className="muted auth-copy">
                Search imported titles, run sync and metadata actions, and remove bad imports
                without dropping back to the legacy admin.
              </p>
            </div>
            <div className="hero-actions">
              <Link href="/admin" className="button">
                Back to overview
              </Link>
              <Link href="/admin/episodes" className="button">
                Episodes
              </Link>
              <a href={`${getLegacyApiBaseUrl()}/admin`} className="button" rel="noreferrer">
                Open legacy admin
              </a>
            </div>
          </div>
        </section>

        <section className="panel watch-copy-panel">
          <form className="filter-form" action="/admin/anime" method="get">
            <input
              name="search"
              defaultValue={parsedQuery.search ?? ""}
              placeholder="Search title, alias, or slug"
            />
            <select name="status" defaultValue={parsedQuery.status ?? ""}>
              <option value="">Any status</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="upcoming">Upcoming</option>
            </select>
            <select name="sourceSite" defaultValue={parsedQuery.sourceSite ?? ""}>
              <option value="">Any source</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            <button type="submit" className="button primary">
              Apply filters
            </button>
          </form>

          <div className="admin-list-row" style={{ marginBottom: 16 }}>
            <div className="muted">
              Showing {catalog.items.length} of {catalog.total} titles
            </div>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              {catalog.hasPreviousPage ? (
                <Link href={buildPaginationHref(catalog.page - 1, resolvedSearchParams)} className="button">
                  Previous page
                </Link>
              ) : null}
              {catalog.hasNextPage ? (
                <Link href={buildPaginationHref(catalog.page + 1, resolvedSearchParams)} className="button">
                  Next page
                </Link>
              ) : null}
            </div>
          </div>

          <AdminAnimeCatalog items={catalog.items} sources={sources} />
        </section>
      </div>
    </main>
  );
}
