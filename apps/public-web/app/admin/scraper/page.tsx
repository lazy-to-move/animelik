import Link from "next/link";
import { AdminScraperTools } from "../../../components/AdminScraperTools";
import { getLegacyApiBaseUrl } from "../../../lib/api";
import { hasDirectAdminAccess } from "../../../lib/admin-auth-source";
import { getCurrentSession } from "../../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Import Sources",
  description:
    "Run source imports, queue probes, and scraper actions from the dedicated Next admin tools page.",
};

export default async function AdminScraperPage() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Admin</div>
            <h1 className="auth-title">Sign in to manage source imports</h1>
            <p className="muted auth-copy">
              The dedicated Next scraper tools page uses the same administrator session as the rest
              of the migrated admin surface.
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
              Source import tools are reserved for administrator accounts.
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
              The Next scraper tools need shared database and session-secret access. Until then,
              keep managing source imports from the legacy admin.
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

  const [{ getAdminOverview }, { getAdminScraperExecutionDetails, listAdminScraperSources }] =
    await Promise.all([
      import("../../../../../api/services/admin-dashboard-service"),
      import("../../../../../api/services/admin-scraper-read-service"),
    ]);
  const [overview, execution, sources] = await Promise.all([
    getAdminOverview(10),
    Promise.resolve(getAdminScraperExecutionDetails()),
    Promise.resolve(listAdminScraperSources()),
  ]);

  return (
    <main className="section">
      <div className="container admin-layout">
        <section className="panel watch-copy-panel">
          <div className="eyebrow">Admin Migration</div>
          <div className="watch-heading-row">
            <div>
              <h1 className="watch-title">Import sources</h1>
              <p className="muted auth-copy">
                This dedicated Next page mirrors the legacy scraper tab, with source discovery,
                import jobs, queue probes, and recent anime actions in one place.
              </p>
            </div>
            <div className="hero-actions">
              <Link href="/admin" className="button">
                Back to overview
              </Link>
              <Link href="/admin/anime" className="button">
                Anime catalog
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

        <AdminScraperTools
          sources={sources}
          execution={execution}
          recentAnime={overview.recentAnime}
        />
      </div>
    </main>
  );
}
