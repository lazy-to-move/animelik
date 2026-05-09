import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section">
      <div className="container state-shell">
        <div className="state-card">
          <div className="eyebrow">404</div>
          <h1>We could not find that anime.</h1>
          <p className="muted">
            The migration frontend asked the legacy catalog API for this route, but no matching title was returned.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/browse">
              Browse library
            </Link>
            <Link className="button" href="/">
              Back home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
