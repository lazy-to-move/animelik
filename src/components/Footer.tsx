import { Link } from "react-router";
import { Tv, Instagram, Twitter, Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 pt-16 pb-8 px-4 sm:px-6 lg:px-8 bg-[#030209]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#693def] to-[#8257f2] flex items-center justify-center shadow-lg shadow-[#693def]/20">
                <Tv className="w-5.5 h-5.5 text-white" />
              </div>
              <span className="text-2xl font-black text-white tracking-tighter">Synx</span>
            </div>
            <p className="text-sm text-[#777777] leading-relaxed font-medium mb-6">
              Your premium destination for anime streaming. Discover, watch, and share your favorite series with the world.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-[#888888] hover:text-[#693def] hover:bg-white/10 transition-all">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-[#888888] hover:text-[#693def] hover:bg-white/10 transition-all">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-[#888888] hover:text-[#693def] hover:bg-white/10 transition-all">
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-6">Navigation</h4>
            <ul className="space-y-4">
              {["Home", "Browse", "Watchlist", "Schedule"].map((item) => (
                <li key={item}>
                  <Link 
                    to={item === "Home" ? "/" : `/${item.toLowerCase()}`} 
                    className="text-sm text-[#777777] hover:text-white transition-colors font-medium"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-6">Genres</h4>
            <ul className="space-y-4">
              {["Action", "Fantasy", "Sci-Fi", "Romance", "Adventure"].map((item) => (
                <li key={item}>
                  <Link 
                    to={`/browse?category=${item.toLowerCase()}`} 
                    className="text-sm text-[#777777] hover:text-white transition-colors font-medium"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-6">Account</h4>
            <ul className="space-y-4">
              <li>
                <Link to="/login" className="text-sm text-[#777777] hover:text-white transition-colors font-medium">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/watchlist" className="text-sm text-[#777777] hover:text-white transition-colors font-medium">
                  My Watchlist
                </Link>
              </li>
              <li>
                <Link to="/settings" className="text-sm text-[#777777] hover:text-white transition-colors font-medium">
                  Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-[11px] text-[#555555] font-bold uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Synx Anime • All rights reserved
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-[11px] text-[#555555] hover:text-[#777777] font-bold uppercase tracking-widest transition-colors">Privacy Policy</a>
            <a href="#" className="text-[11px] text-[#555555] hover:text-[#777777] font-bold uppercase tracking-widest transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
