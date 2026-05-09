import Link from "next/link";
import { AdminScraperTools } from "../../components/AdminScraperTools";
import { getLegacyApiBaseUrl } from "../../lib/api";
import { hasDirectAdminAccess } from "../../lib/admin-auth-source";
import { getCurrentSession } from "../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Overview",
  description:
    "First migration slice for the admin surface, powered directly from the shared Synx database.",
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Never";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function formatJobType(value: string) {
  return value.replaceAll("_", " ");
}

function formatJobStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function AdminPage() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Admin</div>
            <h1 className="auth-title">Sign in to open the admin overview</h1>
            <p className="muted auth-copy">
              The Next.js migration now has its first admin route. Sign in with an
              administrator account to view queue health, catalog totals, and report pressure.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="button primary">
                Sign In
              </Link>
              <Link href="/settings" className="button">
                Account center
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
              Your current account can use the public migration surface, but the admin overview is
              reserved for administrator roles.
            </p>
            <div className="hero-actions">
              <Link href="/settings" className="button primary">
                Back to settings
              </Link>
              <Link href="/" className="button">
                Return home
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
              This overview page needs shared database and session-secret access in the Next service.
              Until then, keep using the legacy admin surface.
            </p>
            <div className="hero-actions">
              <a href={`${getLegacyApiBaseUrl()}/admin`} className="button primary" rel="noreferrer">
                Open legacy admin
              </a>
              <Link href="/settings" className="button">
                Account center
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const [
    { getAdminOverview },
    { getAdminScraperExecutionDetails, listAdminScraperSources },
  ] = await Promise.all([
    import("../../../../api/services/admin-dashboard-service"),
    import("../../../../api/services/admin-scraper-read-service"),
  ]);
  const [overview, scraperExecution, scraperSources] = await Promise.all([
    getAdminOverview(8),
    Promise.resolve(getAdminScraperExecutionDetails()),
    Promise.resolve(listAdminScraperSources()),
  ]);
  const legacyAdminUrl = `${getLegacyApiBaseUrl()}/admin`;

  return (
    <main className="section">
      <div className="container admin-layout">
        <section className="panel watch-copy-panel">
          <div className="eyebrow">Admin Migration</div>
          <div className="watch-heading-row">
            <div>
              <h1 className="watch-title">Admin overview</h1>
              <p className="muted auth-copy">
                This is the first migrated admin route in Next.js. It reads directly from the
                shared database while the heavier management tools still live in the legacy admin.
              </p>
            </div>
            <div className="hero-actions">
              <a href={legacyAdminUrl} className="button" rel="noreferrer">
                Open legacy admin
              </a>
              <Link href="/admin/anime" className="button">
                Anime catalog
              </Link>
              <Link href="/admin/episodes" className="button">
                Episodes
              </Link>
              <Link href="/admin/categories" className="button">
                Categories
              </Link>
              <Link href="/admin/reports" className="button">
                Broken reports
              </Link>
              <Link href="/admin/scraper" className="button">
                Import sources
              </Link>
              <Link href="/settings" className="button primary">
                Account center
              </Link>
            </div>
          </div>
        </section>

        <section className="admin-grid">
          <article className="settings-card admin-stat-card">
            <span className="settings-label">Users</span>
            <strong>{overview.stats.totalUsers}</strong>
          </article>
          <article className="settings-card admin-stat-card">
            <span className="settings-label">Anime</span>
            <strong>{overview.stats.totalAnime}</strong>
          </article>
          <article className="settings-card admin-stat-card">
            <span className="settings-label">Episodes</span>
            <strong>{overview.stats.totalEpisodes}</strong>
          </article>
          <article className="settings-card admin-stat-card">
            <span className="settings-label">Reviews</span>
            <strong>{overview.stats.totalReviews}</strong>
          </article>
          <article className="settings-card admin-stat-card">
            <span className="settings-label">Queue pending</span>
            <strong>{overview.queue.pending}</strong>
          </article>
          <article className="settings-card admin-stat-card">
            <span className="settings-label">Queue running</span>
            <strong>{overview.queue.running}</strong>
          </article>
          <article className="settings-card admin-stat-card">
            <span className="settings-label">Queue failed</span>
            <strong>{overview.queue.failed}</strong>
          </article>
          <article className="settings-card admin-stat-card">
            <span className="settings-label">Queue completed</span>
            <strong>{overview.queue.completed}</strong>
          </article>
        </section>

        <AdminScraperTools
          sources={scraperSources}
          execution={scraperExecution}
          recentAnime={overview.recentAnime}
        />

        <div className="admin-panels">
          <section className="panel watch-copy-panel">
            <div className="row" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Recent scraper jobs</h2>
              <span className="muted">{overview.recentScrapeJobs.length} recent jobs</span>
            </div>
            <div className="admin-list">
              {overview.recentScrapeJobs.length === 0 ? (
                <div className="admin-list-empty muted">No scraper jobs have been queued yet.</div>
              ) : (
                overview.recentScrapeJobs.map((job: (typeof overview.recentScrapeJobs)[number]) => (
                  <article key={job.id} className="admin-list-item">
                    <div className="admin-list-row">
                      <strong>#{job.id} | {formatJobType(job.type)}</strong>
                      <span className={`admin-status-pill status-${job.status}`}>
                        {formatJobStatus(job.status)}
                      </span>
                    </div>
                    <div className="admin-list-meta muted">
                      Requested by {job.requestedByName || job.requestedByEmail || "System"} | Created {formatDate(job.createdAt)}
                    </div>
                    {job.errorMessage ? (
                      <div className="auth-error" style={{ marginTop: 12 }}>
                        {job.errorMessage}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel watch-copy-panel">
            <div className="row" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Most reported broken episodes</h2>
              <span className="muted">{overview.topBrokenEpisodes.length} entries</span>
            </div>
            <div className="admin-list">
              {overview.topBrokenEpisodes.length === 0 ? (
                <div className="admin-list-empty muted">No broken-episode reports yet.</div>
              ) : (
                overview.topBrokenEpisodes.map((item: (typeof overview.topBrokenEpisodes)[number]) => (
                  <article key={item.episodeId} className="admin-list-item">
                    <div className="admin-list-row">
                      <strong>{item.animeTitle} | Episode {item.episodeNumber}</strong>
                      <span className="pill">{item.reportsCount} reports</span>
                    </div>
                    <div className="admin-list-meta muted">
                      Last 24h: {item.reportsLast24h} | Last report: {formatDate(item.lastReportedAt)}
                    </div>
                    {item.animeSlug ? (
                      <div className="settings-links" style={{ marginTop: 12 }}>
                        <Link href={`/anime/${item.animeSlug}`} className="settings-link">
                          Open public anime page
                        </Link>
                        <Link href="/admin/reports" className="settings-link">
                          Open reports page
                        </Link>
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="admin-panels">
          <section className="panel watch-copy-panel">
            <div className="row" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Recent users</h2>
              <span className="muted">{overview.recentUsers.length} users</span>
            </div>
            <div className="admin-list">
              {overview.recentUsers.map((user: (typeof overview.recentUsers)[number]) => (
                <article key={user.id} className="admin-list-item">
                  <div className="admin-list-row">
                    <strong>{user.name || user.email || `User ${user.id}`}</strong>
                    <span className="pill">{user.role}</span>
                  </div>
                  <div className="admin-list-meta muted">
                    {user.email || "No email"} | Joined {formatDate(user.createdAt)}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel watch-copy-panel">
            <div className="row" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Recent anime imports</h2>
              <span className="muted">{overview.recentAnime.length} titles</span>
            </div>
            <div className="admin-list">
              {overview.recentAnime.map((item: (typeof overview.recentAnime)[number]) => (
                <article key={item.id} className="admin-list-item">
                  <div className="admin-list-row">
                    <strong>{item.title}</strong>
                    <span className="pill">{item.status || "unknown"}</span>
                  </div>
                  <div className="admin-list-meta muted">
                    /{item.slug} | Added {formatDate(item.createdAt)}
                  </div>
                  <div className="settings-links" style={{ marginTop: 12 }}>
                    <Link href={`/anime/${item.slug}`} className="settings-link">
                      Open public anime page
                    </Link>
                    <Link
                      href={{
                        pathname: "/admin/anime",
                        query: { search: item.title },
                      }}
                      className="settings-link"
                    >
                      Manage in anime catalog
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
