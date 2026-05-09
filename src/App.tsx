import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

const Home = lazy(() => import("./pages/Home"));
const Browse = lazy(() => import("./pages/Browse"));
const Schedule = lazy(() => import("./pages/Schedule"));
const AnimeDetail = lazy(() => import("./pages/AnimeDetail"));
const Watch = lazy(() => import("./pages/Watch"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Admin = lazy(() => import("./pages/Admin"));
const Login = lazy(() => import("./pages/Login"));
const Settings = lazy(() => import("./pages/Settings"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <div className="h-10 w-10 rounded-full border-2 border-[#693def] border-t-transparent animate-spin" />
    </div>
  );
}

function setMetaTag(selector: string, attribute: "name" | "property", value: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, value);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

function RouteMetadata() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = "Synx Anime";
    let description =
      "Synx Anime is an anime streaming and discovery experience for browsing series, tracking schedules, saving watchlists, and syncing episodes from supported sources.";
    let robots = "index,follow";

    if (path === "/") {
      title = "Synx Anime | Stream and Discover Anime";
      description = "Discover featured anime, trending series, fresh releases, and community picks on Synx Anime.";
    } else if (path.startsWith("/browse")) {
      title = "Browse Anime | Synx Anime";
      description = "Search and filter anime by status, genre, type, and release year inside the Synx Anime library.";
    } else if (path.startsWith("/schedule")) {
      title = "Weekly Anime Schedule | Synx Anime";
      description = "Track ongoing anime by release day with the Synx weekly schedule and broadcast calendar.";
    } else if (path.startsWith("/anime/")) {
      title = "Anime Details | Synx Anime";
      description = "Read anime details, browse episodes, and manage your watchlist on Synx Anime.";
    } else if (path.startsWith("/watch/")) {
      title = "Watch Anime Episode | Synx Anime";
      description = "Stream anime episodes from your Synx library with selectable sources and quality options.";
      robots = "noindex,nofollow";
    } else if (path === "/watchlist") {
      title = "Your Watchlist | Synx Anime";
      description = "Manage saved anime, progress tracking, and watch status in your personal Synx watchlist.";
      robots = "noindex,nofollow";
    } else if (path === "/settings") {
      title = "Account Settings | Synx Anime";
      description = "Review your Synx Anime account details, admin access, and session controls.";
      robots = "noindex,nofollow";
    } else if (path === "/login" || path === "/signup") {
      title = path === "/signup" ? "Create Account | Synx Anime" : "Sign In | Synx Anime";
      description = "Sign in to Synx Anime or create an account to manage watchlists, reviews, and viewing progress.";
      robots = "noindex,nofollow";
    } else if (path === "/admin") {
      title = "Admin Dashboard | Synx Anime";
      description = "Manage anime, episodes, categories, schedules, and source imports in the Synx admin dashboard.";
      robots = "noindex,nofollow";
    } else if (path === "/privacy") {
      title = "Privacy Policy | Synx Anime";
      description = "Read how Synx Anime handles account data, cookies, watchlists, and operational logs.";
    } else if (path === "/terms") {
      title = "Terms of Service | Synx Anime";
      description = "Review the platform terms, acceptable use rules, and content responsibilities for Synx Anime.";
    } else {
      title = "Page Not Found | Synx Anime";
      description = "The page you requested could not be found on Synx Anime.";
      robots = "noindex,nofollow";
    }

    const canonicalUrl = `${window.location.origin}${path}${location.search}`;
    document.title = title;
    setMetaTag('meta[name="description"]', "name", "description", description);
    setMetaTag('meta[property="og:title"]', "property", "og:title", title);
    setMetaTag('meta[property="og:description"]', "property", "og:description", description);
    setMetaTag('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    setMetaTag('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMetaTag('meta[name="twitter:description"]', "name", "twitter:description", description);
    setMetaTag('meta[name="robots"]', "name", "robots", robots);
    setCanonical(canonicalUrl);
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <div className="flex min-h-screen flex-col bg-[#030209]">
      <RouteMetadata />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[#693def] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-[0_12px_40px_rgba(105,61,239,0.45)]"
      >
        Skip to content
      </a>
      {!isAuthRoute && <Navbar />}
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/anime/:slug" element={<AnimeDetail />} />
            <Route path="/watch/:slug/:episodeNum" element={<Watch />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isAuthRoute && <Footer />}
    </div>
  );
}
