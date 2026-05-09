import Link from "next/link";
import { LogoutButton } from "../../components/LogoutButton";
import { getLegacyApiBaseUrl } from "../../lib/api";
import { getCurrentSession, getCurrentWatchlist } from "../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings",
  description:
    "Review your account snapshot and migration-ready quick links in the Next.js public app.",
};

export default async function SettingsPage() {
  const session = await getCurrentSession();
  const watchlistItems = session ? await getCurrentWatchlist() : null;

  if (!session) {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Settings</div>
            <h1 className="auth-title">Sign in to open your account center</h1>
            <p className="muted auth-copy">
              The Next.js migration now has its own authenticated settings
              surface. Sign in to review your session, quick links, and personal
              library summary here.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="button primary">
                Sign In
              </Link>
              <Link href="/signup" className="button">
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const watchlistCount = watchlistItems?.length ?? 0;
  const activeCount =
    watchlistItems?.filter((item) => item.status === "watching").length ?? 0;
  const completedCount =
    watchlistItems?.filter((item) => item.status === "completed").length ?? 0;
  const legacyAdminUrl =
    session.role === "admin" ? `${getLegacyApiBaseUrl()}/admin` : null;

  return (
    <main className="section">
      <div className="container settings-layout">
        <section className="panel watch-copy-panel settings-hero">
          <div className="eyebrow">Account Center</div>
          <div className="watch-heading-row">
            <div>
              <h1 className="watch-title">Settings</h1>
              <p className="muted auth-copy">
                This route now lives in the Next.js migration surface while the
                underlying account and watchlist data still come from the legacy
                app.
              </p>
            </div>
            <div className="settings-pill">
              <strong>{session.name || "Viewer"}</strong>
              <span>{session.role === "admin" ? "Administrator" : "Member"}</span>
            </div>
          </div>
        </section>

        <div className="settings-grid">
          <section className="panel watch-copy-panel">
            <h2 style={{ marginTop: 0 }}>Account snapshot</h2>
            <div className="settings-stat-grid">
              <div className="settings-card">
                <span className="settings-label">Display name</span>
                <strong>{session.name || "Not set"}</strong>
              </div>
              <div className="settings-card">
                <span className="settings-label">Email</span>
                <strong>{session.email || "Unavailable"}</strong>
              </div>
              <div className="settings-card">
                <span className="settings-label">Role</span>
                <strong>{session.role === "admin" ? "Admin" : "User"}</strong>
              </div>
              <div className="settings-card">
                <span className="settings-label">Session</span>
                <strong>Active on this device</strong>
              </div>
            </div>
          </section>

          <section className="panel watch-copy-panel">
            <h2 style={{ marginTop: 0 }}>Library snapshot</h2>
            <div className="settings-stat-grid">
              <div className="settings-card">
                <span className="settings-label">Watchlist titles</span>
                <strong>{watchlistCount}</strong>
              </div>
              <div className="settings-card">
                <span className="settings-label">Currently watching</span>
                <strong>{activeCount}</strong>
              </div>
              <div className="settings-card">
                <span className="settings-label">Completed</span>
                <strong>{completedCount}</strong>
              </div>
              <div className="settings-card">
                <span className="settings-label">Migration surface</span>
                <strong>Next public app</strong>
              </div>
            </div>
          </section>
        </div>

        <div className="settings-grid">
          <section className="panel watch-copy-panel">
            <h2 style={{ marginTop: 0 }}>Quick links</h2>
            <div className="settings-links">
              <Link href="/watchlist" className="settings-link">
                Open watchlist
              </Link>
              <Link href="/browse" className="settings-link">
                Browse anime
              </Link>
              <Link href="/schedule" className="settings-link">
                Weekly schedule
              </Link>
              <Link href="/privacy" className="settings-link">
                Privacy policy
              </Link>
              <Link href="/terms" className="settings-link">
                Terms of service
              </Link>
              {session.role === "admin" ? (
                <Link href="/admin" className="settings-link primary">
                  Open Next admin overview
                </Link>
              ) : null}
              {legacyAdminUrl ? (
                <a
                  href={legacyAdminUrl}
                  className="settings-link"
                  rel="noreferrer"
                >
                  Open legacy admin
                </a>
              ) : null}
            </div>
          </section>

          <section className="panel watch-copy-panel settings-danger">
            <h2 style={{ marginTop: 0 }}>Session control</h2>
            <p className="muted auth-copy">
              Password change and account deletion still live outside this
              migration surface, but you can safely sign out from here.
            </p>
            <div className="hero-actions">
              <LogoutButton />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
