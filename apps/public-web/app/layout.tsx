import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "../components/LogoutButton";
import { getCurrentSession } from "../lib/server-api";
import "./globals.css";
import { getPublicSiteUrl } from "../lib/api";

const metadataBase = new URL(getPublicSiteUrl());

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Synx Next Public",
    template: "%s | Synx Next Public",
  },
  description:
    "Next.js migration surface for the public Synx anime experience, powered by the legacy API during the strangler transition.",
  alternates: {
    canonical: metadataBase,
  },
  openGraph: {
    title: "Synx Next Public",
    description:
      "Next.js migration surface for the public Synx anime experience, powered by the legacy API during the strangler transition.",
    url: metadataBase,
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession();

  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <header className="topbar">
            <div className="container topbar-inner">
              <Link href="/" className="brand">
                Syn<span>x</span> Next
              </Link>
              <nav className="nav" aria-label="Primary">
                <Link href="/">Home</Link>
                <Link href="/browse">Browse</Link>
                <Link href="/schedule">Schedule</Link>
                <Link href="/watchlist">Watchlist</Link>
                <Link href="/settings">Settings</Link>
                {session?.role === "admin" ? <Link href="/admin">Admin</Link> : null}
              </nav>
              <div className="nav-auth">
                {session ? (
                  <>
                    <span className="nav-user">
                      {session.name || session.email || "Account"}
                    </span>
                    <LogoutButton />
                  </>
                ) : (
                  <Link href="/login" className="nav-action">
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </header>
          {children}
          <footer className="footer">
            <div className="container footer-inner">
              <span>
                Next.js migration surface for the public anime experience. The
                legacy Hono app still powers data and admin flows during
                transition.
              </span>
              <div className="footer-links">
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
