import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Search, Bookmark, User, LogOut, Menu, X, Shield, Tv, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const isWatchPage = location.pathname.startsWith("/watch/");
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

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
    { label: "Schedule", path: "/schedule" },
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#693def] to-[#8257f2] flex items-center justify-center transition-all duration-300 ease-out group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-[0_0_30px_rgba(105,61,239,0.5)] shadow-[0_0_20px_rgba(105,61,239,0.3)]">
              <Tv className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-white bg-clip-text group-hover:text-[#a78bfa] transition-colors duration-300">
              Synx
            </span>
          </Link>

          {/* Desktop Links */}
          <div className={`items-center gap-1 ${isWatchPage ? "hidden lg:flex" : "hidden md:flex"}`}>
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => {
                  setMobileOpen(false);
                  setSearchOpen(false);
                  setProfileOpen(false);
                }}
                className={`relative px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ease-out ${
                  location.pathname === link.path
                    ? "text-white bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    : "text-[#aaaaaa] hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
                {location.pathname === link.path && (
                  <span className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />
                )}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => {
                  setMobileOpen(false);
                  setSearchOpen(false);
                  setProfileOpen(false);
                }}
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
              type="button"
              onClick={() => {
                setSearchOpen((open) => !open);
                setProfileOpen(false);
                setMobileOpen(false);
              }}
              className="p-2.5 rounded-full text-[#cccccc] hover:text-white hover:bg-white/10 transition-all duration-300 ease-out hover:scale-105 active:scale-95"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* User / Auth */}
            {user ? (
              <div className="flex items-center gap-2">
              <Link
                  to="/watchlist"
                  className="hidden md:flex p-2.5 rounded-full text-[#cccccc] hover:text-white hover:bg-white/10 transition-all duration-300 ease-out hover:scale-105 active:scale-95"
                >
                  <Bookmark className="w-5 h-5" />
                </Link>
                <div ref={profileMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen((open) => !open);
                      setSearchOpen(false);
                      setMobileOpen(false);
                    }}
                    className={`flex items-center gap-2 rounded-full border px-1.5 py-1.5 pr-2.5 transition-all duration-300 ease-out ${
                      profileOpen
                        ? "bg-white/12 border-white/20 shadow-[0_10px_32px_rgba(0,0,0,0.28)]"
                        : "bg-white/[0.045] border-white/10 hover:bg-white/8 hover:border-white/16"
                    }`}
                  >
                    <img
                      src={user.avatar || "/avatars/user1.jpg"}
                      alt={user.name || "User"}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <span className="hidden max-w-[112px] truncate text-sm font-medium text-white sm:block">
                      {user.name || "User"}
                    </span>
                    <ChevronDown
                      className={`hidden h-4 w-4 text-[#9f96c7] transition-transform duration-200 sm:block ${
                        profileOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <div
                    className={`absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[240px] overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(14,10,28,0.92)] shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-all duration-200 ease-out-expo ${
                      profileOpen
                        ? "visible translate-y-0 opacity-100 pointer-events-auto"
                        : "invisible -translate-y-2 opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="border-b border-white/6 px-4 py-3.5">
                      <p className="truncate text-sm font-semibold text-white">
                        {user.name || "User"}
                      </p>
                      <p className="mt-1 truncate text-xs text-[#9b92bb]">
                        {user.email || ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-[#d7d1ee] transition-colors hover:bg-white/6 hover:text-white"
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
                onClick={() => {
                  setSearchOpen(false);
                  setProfileOpen(false);
                  setMobileOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#693def] text-white text-sm font-medium hover:bg-[#8257f2] transition-all duration-300 ease-out hover:shadow-[0_0_25px_rgba(105,61,239,0.4)] hover:scale-105 active:scale-95"
              >
                <User className="w-4 h-4" />
                Sign In
              </Link>
            )}

            {/* Mobile Menu */}
            <button
              type="button"
              onClick={() => {
                setMobileOpen((open) => !open);
                setSearchOpen(false);
                setProfileOpen(false);
              }}
              className={`${isWatchPage ? "lg:hidden" : "md:hidden"} p-2.5 rounded-full text-[#cccccc] hover:text-white hover:bg-white/10 transition-all duration-300 ease-out hover:scale-105 active:scale-95`}
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
            {user && (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="px-4 py-3 rounded-xl text-sm font-medium text-[#cccccc] hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 text-left"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
