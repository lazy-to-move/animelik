import Link from "next/link";
import { WatchlistShelf } from "../../components/WatchlistShelf";
import { getCurrentSession, getCurrentWatchlist } from "../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Watchlist",
  description:
    "Review your saved anime and progress from the Next.js migration frontend.",
};

export default async function WatchlistPage() {
  const session = await getCurrentSession();
  const items = session ? await getCurrentWatchlist() : null;

  if (!session) {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Watchlist</div>
            <h1 className="auth-title">Sign in to open your library</h1>
            <p className="muted auth-copy">
              The migration frontend can now read your session and personal
              watchlist. Sign in to see saved anime and progress here.
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

  return (
    <main className="section">
      <div className="container">
        <div className="panel watch-copy-panel" style={{ marginBottom: 24 }}>
          <div className="eyebrow">Personal Library</div>
          <div className="watch-heading-row">
            <div>
              <h1 className="watch-title">Watchlist</h1>
              <p className="muted auth-copy">
                Welcome back, {session.name || session.email || "viewer"}.
                This page is rendered in Next.js while still reading your saved
                library from the legacy app.
              </p>
            </div>
            <Link href="/browse" className="button">
              Browse anime
            </Link>
          </div>
        </div>

        <WatchlistShelf initialItems={items ?? []} />
      </div>
    </main>
  );
}
