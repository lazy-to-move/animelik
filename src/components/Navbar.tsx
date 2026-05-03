import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Search, Bookmark, User, LogOut, Menu, X, Shield, Tv } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const isWatchPage = location.pathname.startsWith("/watch/");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Browse", path: "/browse" },
    { label: "Watchlist", path: "/watchlist" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled || isWatchPage ? "glass-nav py-3" : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#693def] to-[#8257f2] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-[0_0_20px_rgba(105,61,239,0.3)]">
              <Tv className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-white bg-clip-text">
              Synx
            </span>
          </Link>

          {/* Desktop Links */}
          <div className={`items-center gap-2 ${isWatchPage ? "hidden lg:flex" : "hidden md:flex"}`}>
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  location.pathname === link.path
                    ? "text-white bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    : "text-[#aaaaaa] hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                  location.pathname === "/admin"
                    ? "text-white bg-[#693def]/20 border border-[#693def]/30"
                    : "text-[#693def] hover:bg-[#693def]/10"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Dashboard
              </Link>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2.5 rounded-full text-[#cccccc] hover:text-white hover:bg-white/10 transition-all"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* User / Auth */}
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/watchlist"
                  className="hidden md:flex p-2.5 rounded-full text-[#cccccc] hover:text-white hover:bg-white/10 transition-all"
                >
                  <Bookmark className="w-5 h-5" />
                </Link>
                <div className="relative group">
                  <button className="flex items-center gap-2 p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                    <img
                      src={user.avatar || "/avatars/user1.jpg"}
                      alt={user.name || "User"}
                      className="w-8 h-8 rounded-full object-cover shadow-lg"
                    />
                    <span className="text-sm font-medium text-white px-1 hidden sm:block max-w-[100px] truncate">
                      {user.name || "User"}
                    </span>
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 glass-panel opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden">
                    <div className="p-3 border-b border-white/5">
                      <p className="text-sm font-medium text-white truncate">
                        {user.name || "User"}
                      </p>
                      <p className="text-xs text-[#888888] truncate">
                        {user.email || ""}
                      </p>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#cccccc] hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#693def] text-white text-sm font-medium hover:bg-[#8257f2] transition-colors"
              >
                <User className="w-4 h-4" />
                Sign In
              </Link>
            )}

            {/* Mobile Menu */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`${isWatchPage ? "lg:hidden" : "md:hidden"} p-2.5 rounded-full text-[#cccccc] hover:text-white hover:bg-white/10 transition-all`}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Search Overlay */}
      {searchOpen && (
        <div className="absolute top-full left-0 right-0 glass-nav p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anime by title..."
                autoFocus
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-[#888888] focus:outline-none focus:border-[#693def] focus:ring-1 focus:ring-[#693def] transition-all"
              />
            </div>
          </form>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className={`${isWatchPage ? "lg:hidden" : "md:hidden"} absolute top-full left-0 right-0 glass-panel m-4 p-4 animate-in fade-in slide-in-from-top-2 duration-200`}>
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === link.path
                    ? "text-white bg-white/10"
                    : "text-[#cccccc] hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="px-4 py-3 rounded-xl text-sm font-medium text-[#693def] hover:bg-[#693def]/10 transition-all flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Admin Dashboard
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
