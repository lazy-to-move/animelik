import { Suspense, lazy } from "react";
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
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-[#693def] border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <div className="min-h-screen bg-[#030209]">
      {!isAuthRoute && <Navbar />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/anime/:slug" element={<AnimeDetail />} />
          <Route path="/watch/:slug/:episodeNum" element={<Watch />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {!isAuthRoute && <Footer />}
    </div>
  );
}
