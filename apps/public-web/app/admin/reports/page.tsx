import Link from "next/link";
import { getLegacyApiBaseUrl } from "../../../lib/api";
import { hasDirectAdminAccess } from "../../../lib/admin-auth-source";
import { getCurrentSession } from "../../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Reports",
  description:
    "Review the most-reported broken episodes and recent report activity from the Next admin surface.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Never";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default async function AdminReportsPage({
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
            <h1 className="auth-title">Sign in to review broken-episode reports</h1>
            <p className="muted auth-copy">
              This migrated reports view uses the same administrator session as the rest of the
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
              Broken-episode reporting tools are reserved for administrator accounts.
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
              The Next reports page needs shared database and session-secret access. Until then,
              keep using the legacy reports tab.
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
  const {
    adminBrokenEpisodeListQuerySchema,
    listAdminBrokenEpisodeLeaderboard,
    listRecentBrokenEpisodeReports,
  } = await import("../../../../../api/services/admin-broken-report-service");
  const query = adminBrokenEpisodeListQuerySchema.parse({
    search: pickString(resolvedSearchParams.search),
  });
  const [leaderboard, recentReports] = await Promise.all([
    listAdminBrokenEpisodeLeaderboard({ search: query.search, limit: query.limit }),
    listRecentBrokenEpisodeReports({ search: query.search, limit: query.recentLimit }),
  ]);

  return (
    <main className="section">
      <div className="container admin-layout">
        <section className="panel watch-copy-panel">
          <div className="eyebrow">Admin Migration</div>
          <div className="watch-heading-row">
            <div>
              <h1 className="watch-title">Broken episode reports</h1>
              <p className="muted auth-copy">
                Review pressure from user-reported playback issues directly in Next while the
                heavier scraper management tools continue to live in the legacy admin.
              </p>
            </div>
            <div className="hero-actions">
              <Link href="/admin" className="button">
                Back to overview
              </Link>
              <Link href="/admin/episodes" className="button">
                Episodes
              </Link>
              <Link href="/admin/anime" className="button">
                Anime catalog
              </Link>
              <Link href="/admin/categories" className="button">
                Categories
              </Link>
              <a href={`${getLegacyApiBaseUrl()}/admin`} className="button" rel="noreferrer">
                Open legacy admin
              </a>
            </div>
          </div>
        </section>

        <section className="panel watch-copy-panel">
          <form className="filter-form" action="/admin/reports" method="get">
            <input
              aria-label="Search broken episode reports"
              name="search"
              defaultValue={query.search ?? ""}
              placeholder="Search anime title, slug, or episode"
            />
            <button type="submit" className="button primary">
              Apply filters
            </button>
          </form>

          <section className="admin-grid" aria-label="Report summary">
            <article className="settings-card admin-stat-card">
              <span className="settings-label">Reported episodes</span>
              <strong>{leaderboard.length}</strong>
            </article>
            <article className="settings-card admin-stat-card">
              <span className="settings-label">Recent report events</span>
              <strong>{recentReports.length}</strong>
            </article>
            <article className="settings-card admin-stat-card">
              <span className="settings-label">24h volume</span>
              <strong>{leaderboard.reduce((sum, item) => sum + item.reportsLast24h, 0)}</strong>
            </article>
            <article className="settings-card admin-stat-card">
              <span className="settings-label">Top episode pressure</span>
              <strong>{leaderboard[0]?.reportsCount ?? 0}</strong>
            </article>
          </section>
        </section>

        <div className="admin-panels">
          <section className="panel watch-copy-panel">
            <div className="row" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Most reported episodes</h2>
              <span className="muted">{leaderboard.length} entries</span>
            </div>
            <div className="admin-list">
              {leaderboard.length === 0 ? (
                <div className="admin-list-empty muted">No broken-episode reports matched this filter.</div>
              ) : (
                leaderboard.map((item) => (
                  <article key={item.episodeId} className="admin-list-item">
                    <div className="admin-list-row">
                      <strong>
                        {item.animeTitle} | Episode {item.episodeNumber}
                      </strong>
                      <span className="pill">{item.reportsCount} reports</span>
                    </div>
                    <div className="admin-list-meta muted">
                      Last 24h: {item.reportsLast24h} | Last report: {formatDate(item.lastReportedAt)}
                    </div>
                    {item.episodeTitle ? (
                      <div className="admin-list-meta muted">{item.episodeTitle}</div>
                    ) : null}
                    <div className="settings-links" style={{ marginTop: 12 }}>
                      <Link href={`/anime/${item.animeSlug}`} className="settings-link">
                        Open public anime page
                      </Link>
                      <Link
                        href={{
                          pathname: "/admin/anime",
                          query: { search: item.animeTitle },
                        }}
                        className="settings-link"
                      >
                        Manage in anime catalog
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel watch-copy-panel">
            <div className="row" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Recent report activity</h2>
              <span className="muted">{recentReports.length} entries</span>
            </div>
            <div className="admin-list">
              {recentReports.length === 0 ? (
                <div className="admin-list-empty muted">No recent report events matched this filter.</div>
              ) : (
                recentReports.map((item) => (
                  <article key={item.id} className="admin-list-item">
                    <div className="admin-list-row">
                      <strong>
                        {item.animeTitle} | Episode {item.episodeNumber}
                      </strong>
                      <span className="pill">{formatDate(item.createdAt)}</span>
                    </div>
                    <div className="admin-list-meta muted">
                      Reported by {item.reportedByName || item.reportedByEmail || "Unknown user"}
                    </div>
                    {item.episodeTitle ? (
                      <div className="admin-list-meta muted">{item.episodeTitle}</div>
                    ) : null}
                    <div className="settings-links" style={{ marginTop: 12 }}>
                      <Link href={`/watch/${item.animeSlug}/${item.episodeNumber}`} className="settings-link">
                        Open public watch page
                      </Link>
                      <Link
                        href={{
                          pathname: "/admin/anime",
                          query: { search: item.animeTitle },
                        }}
                        className="settings-link"
                      >
                        Manage in anime catalog
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
