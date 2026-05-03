import { Routes, Route, useLocation } from "react-router";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import AnimeDetail from "./pages/AnimeDetail";
import Watch from "./pages/Watch";
import Watchlist from "./pages/Watchlist";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

export default function App() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <div className="min-h-screen bg-[#030209]">
      {!isAuthRoute && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/anime/:slug" element={<AnimeDetail />} />
        <Route path="/watch/:slug/:episodeNum" element={<Watch />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isAuthRoute && <Footer />}
    </div>
  );
}
