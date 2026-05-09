import { Link } from "react-router";
import { Github, Instagram, Tv, Twitter } from "lucide-react";

const socialLinks = [
  {
    label: "Twitter",
    icon: Twitter,
    href: "",
  },
  {
    label: "Instagram",
    icon: Instagram,
    href: "",
  },
  {
    label: "GitHub",
    icon: Github,
    href: "https://github.com/jraya106/animelik",
  },
] as const;

export default function Footer() {
  return (
    <footer role="contentinfo" className="bg-[#030209] px-4 pb-8 pt-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl border-t border-white/5 pt-16">
        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 md:col-span-1">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#693def] to-[#8257f2] shadow-lg shadow-[#693def]/20">
                <Tv className="h-5.5 w-5.5 text-white" />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">Synx</span>
            </div>
            <p className="mb-6 text-sm font-medium leading-relaxed text-[#777777]">
              Your premium destination for anime streaming. Discover, watch, and share your favorite series with the world.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((link) => {
                const Icon = link.icon;

                if (!link.href) {
                  return (
                    <span
                      key={link.label}
                      title={`${link.label} link coming soon`}
                      aria-hidden="true"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[#5e586f]"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  );
                }

                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${link.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[#888888] transition-all duration-300 ease-out hover:scale-110 hover:bg-white/10 hover:text-[#693def] hover:shadow-[0_0_20px_rgba(105,61,239,0.3)]"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h4 id="footer-navigation" className="mb-6 text-xs font-black uppercase tracking-[0.2em] text-white">Navigation</h4>
            <nav aria-labelledby="footer-navigation">
              <ul className="space-y-3">
                {[
                  { label: "Home", path: "/" },
                  { label: "Browse", path: "/browse" },
                  { label: "Watchlist", path: "/watchlist" },
                  { label: "Schedule", path: "/schedule" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.path}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#777777] transition-all duration-200 ease-out hover:translate-x-1 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <h4 id="footer-genres" className="mb-6 text-xs font-black uppercase tracking-[0.2em] text-white">Genres</h4>
            <nav aria-labelledby="footer-genres">
              <ul className="space-y-3">
                {["Action", "Fantasy", "Sci-Fi", "Romance", "Adventure"].map((item) => (
                  <li key={item}>
                    <Link
                      to={`/browse?category=${item.toLowerCase()}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#777777] transition-all duration-200 ease-out hover:translate-x-1 hover:text-white"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <h4 id="footer-account" className="mb-6 text-xs font-black uppercase tracking-[0.2em] text-white">Account</h4>
            <nav aria-labelledby="footer-account">
              <ul className="space-y-3">
                <li>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#777777] transition-all duration-200 ease-out hover:translate-x-1 hover:text-white"
                  >
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link
                    to="/watchlist"
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#777777] transition-all duration-200 ease-out hover:translate-x-1 hover:text-white"
                  >
                    My Watchlist
                  </Link>
                </li>
                <li>
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#777777] transition-all duration-200 ease-out hover:translate-x-1 hover:text-white"
                  >
                    Settings
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 sm:flex-row">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#555555]">
            &copy; {new Date().getFullYear()} Synx Anime &middot; All rights reserved
          </p>
          <div className="flex items-center gap-6">
            <Link
              to="/privacy"
              className="text-[11px] font-bold uppercase tracking-widest text-[#555555] transition-all duration-200 hover:text-white hover:underline hover:underline-offset-4"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-[11px] font-bold uppercase tracking-widest text-[#555555] transition-all duration-200 hover:text-white hover:underline hover:underline-offset-4"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
