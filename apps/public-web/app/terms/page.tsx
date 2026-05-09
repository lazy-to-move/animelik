import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description:
    "Terms overview for using the Next.js public migration surface and the wider Synx platform.",
};

export default function TermsPage() {
  return (
    <main className="section">
      <div className="container legal-layout">
        <section className="panel watch-copy-panel">
          <div className="eyebrow">Policy</div>
          <h1 className="watch-title">Terms of Service</h1>
          <p className="muted auth-copy">
            These terms describe the basic expectations for using Synx while the
            public site is migrating to its new Next.js frontend.
          </p>
        </section>

        <section className="panel watch-copy-panel legal-stack">
          <article>
            <h2>Acceptable use</h2>
            <p className="muted">
              Use the platform lawfully and do not attempt to abuse accounts,
              admin routes, background workers, or scraping tools.
            </p>
          </article>

          <article>
            <h2>Account responsibility</h2>
            <p className="muted">
              You are responsible for activity performed through your account.
              Keep your credentials secure and report unauthorized access as soon
              as you notice it.
            </p>
          </article>

          <article>
            <h2>Content availability</h2>
            <p className="muted">
              Catalog information, artwork, and video sources depend on external
              providers and may change or disappear without notice.
            </p>
          </article>

          <article>
            <h2>Operational changes</h2>
            <p className="muted">
              Synx is evolving during this migration. Features, routes, and
              background processing behavior may change as the new architecture
              replaces the legacy surface in stages.
            </p>
          </article>

          <article>
            <h2>Service boundaries</h2>
            <p className="muted">
              The platform can suspend abusive access, restrict broken providers,
              or temporarily disable background features to protect stability.
            </p>
          </article>
        </section>

        <div className="hero-actions">
          <Link href="/settings" className="button primary">
            Back to settings
          </Link>
          <Link href="/" className="button">
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
