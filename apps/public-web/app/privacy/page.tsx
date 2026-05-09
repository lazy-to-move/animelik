import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description:
    "Privacy overview for the Next.js public migration surface and the connected Synx platform.",
};

export default function PrivacyPage() {
  return (
    <main className="section">
      <div className="container legal-layout">
        <section className="panel watch-copy-panel">
          <div className="eyebrow">Policy</div>
          <h1 className="watch-title">Privacy Policy</h1>
          <p className="muted auth-copy">
            This migration surface uses the same Synx account and content data
            as the legacy app. The policy below explains what the platform keeps
            to power watchlists, progress, and authenticated browsing.
          </p>
        </section>

        <section className="panel watch-copy-panel legal-stack">
          <article>
            <h2>Information we store</h2>
            <p className="muted">
              Synx stores account identity details such as your email address,
              display name, avatar, session timestamps, and personal library
              actions like watchlist status and current episode progress.
            </p>
          </article>

          <article>
            <h2>Why we use it</h2>
            <p className="muted">
              The data is used to sign you in, remember what you are watching,
              personalize library pages, and protect admin-only routes from
              unauthorized access.
            </p>
          </article>

          <article>
            <h2>Third-party sources</h2>
            <p className="muted">
              Catalog metadata, artwork, and episode sources may originate from
              external content providers and metadata services. Synx stores only
              the fields needed to display and organize that information.
            </p>
          </article>

          <article>
            <h2>Security basics</h2>
            <p className="muted">
              Session cookies, origin checks, validation, and rate limiting are
              used to reduce unauthorized access. No system is perfect, so keep
              your password unique and report anything suspicious quickly.
            </p>
          </article>

          <article>
            <h2>Your choices</h2>
            <p className="muted">
              You can sign out at any time from the settings screen. Additional
              account management controls can be added later as the migration
              continues.
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
