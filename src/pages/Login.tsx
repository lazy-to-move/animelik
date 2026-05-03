import { Tv, Sparkles, Key } from "lucide-react";
import { motion } from "framer-motion";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const handleDevLogin = async () => {
    try {
      const res = await fetch("/api/trpc/auth.devLogin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.result?.data?.json?.success) {
        window.location.reload();
      } else {
        alert("Login failed: " + (data.result?.data?.json?.error || data.error?.message || "Unknown error"));
      }
    } catch (e) {
      alert("Login error: " + (e as Error).message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030209] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#693def]/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="glass-panel p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#693def] flex items-center justify-center mx-auto mb-4 violet-glow">
              <Tv className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Welcome to Synx</h1>
            <p className="text-sm text-[#888888]">Sign in to start watching</p>
          </div>

          {/* Sign In Button */}
          <button
            onClick={() => {
              window.location.href = getOAuthUrl();
            }}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-[#693def] text-white font-semibold hover:bg-[#8257f2] transition-all duration-300 hover:scale-[1.02] violet-glow mb-3"
          >
            <Sparkles className="w-5 h-5" />
            Sign in with Kimi
          </button>

          {/* Dev Login Button */}
          <button
            onClick={handleDevLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-all duration-300"
          >
            <Key className="w-5 h-5" />
            Dev Login (Admin)
          </button>

          <p className="text-center text-xs text-[#888888] mt-6">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
