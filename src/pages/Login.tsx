import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Loader2, ShieldCheck, Sparkles, Tv } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  if (!kimiAuthUrl || !appID) return null;

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

type AuthMode = "signin" | "signup";

const defaultForm = {
  name: "",
  email: "",
  password: "",
};

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>(location.pathname === "/signup" ? "signup" : "signin");
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");

  const utils = trpc.useUtils();
  const oauthUrl = useMemo(() => getOAuthUrl(), []);

  const signInMutation = trpc.auth.signIn.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
    onError: (mutationError) => {
      setError(mutationError.message);
    },
  });

  const signUpMutation = trpc.auth.signUp.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
    onError: (mutationError) => {
      setError(mutationError.message);
    },
  });

  const devLoginMutation = trpc.auth.devLogin.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
    onError: (mutationError) => {
      setError(mutationError.message);
    },
  });

  useEffect(() => {
    setMode(location.pathname === "/signup" ? "signup" : "signin");
  }, [location.pathname]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const isSubmitting =
    signInMutation.isPending || signUpMutation.isPending || devLoginMutation.isPending;

  const title = mode === "signin" ? "Sign in to Synx" : "Create your Synx account";
  const subtitle =
    mode === "signin"
      ? "Pick up your watchlist, continue episodes, and keep your account under your control."
      : "Create a real site account with email and password so you can track anime properly.";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (mode === "signup") {
      await signUpMutation.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      return;
    }

    await signInMutation.mutateAsync({
      email: form.email.trim(),
      password: form.password,
    });
  };

  const switchMode = (nextMode: AuthMode) => {
    setError("");
    setForm(defaultForm);
    navigate(nextMode === "signin" ? "/login" : "/signup");
  };

  return (
    <div className="min-h-screen bg-[#030209] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(105,61,239,0.28),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(31,181,255,0.14),_transparent_28%)]" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[560px] h-[560px] bg-[#693def]/10 rounded-full blur-[120px]" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-5xl grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="hidden lg:flex flex-col justify-between glass-panel p-10 min-h-[640px]">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[#d7d0ff]">
                <Tv className="w-4 h-4 text-[#8a63ff]" />
                Built for anime tracking, watch history, and multi-source streaming
              </div>

              <h1 className="mt-8 text-5xl font-black leading-[1] tracking-tight text-white">
                Proper account access for your anime site.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-[#b8b0d9]">
                Save your watchlist, keep session state stable, and stop relying on a dev shortcut
                as the main entry point.
              </p>
            </div>

            <div className="grid gap-4">
              <FeatureCard
                icon={<ShieldCheck className="w-5 h-5 text-[#8a63ff]" />}
                title="Real site-owned auth"
                text="Email and password accounts that belong to your platform, not a temporary workaround."
              />
              <FeatureCard
                icon={<Sparkles className="w-5 h-5 text-[#31d0ff]" />}
                title="Keeps your app flow clean"
                text="Same session cookie model, cleaner routing, and a stable base for watchlists, reviews, and admin access."
              />
            </div>
          </div>

          <div className="glass-panel p-6 sm:p-8 lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#693def] to-[#8a63ff] flex items-center justify-center shadow-[0_20px_60px_rgba(105,61,239,0.3)]">
                  <Tv className="w-7 h-7 text-white" />
                </div>
                <h2 className="mt-6 text-3xl font-bold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#a39abf]">{subtitle}</p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  mode === "signin"
                    ? "bg-[#6f46f6] text-white shadow-[0_12px_32px_rgba(111,70,246,0.35)]"
                    : "text-[#9d95bc] hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  mode === "signup"
                    ? "bg-[#6f46f6] text-white shadow-[0_12px_32px_rgba(111,70,246,0.35)]"
                    : "text-[#9d95bc] hover:text-white"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {mode === "signup" && (
                <Field
                  label="Display name"
                  type="text"
                  value={form.name}
                  onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                  placeholder="Your name"
                  autoComplete="name"
                />
              )}

              <Field
                label="Email address"
                type="email"
                value={form.email}
                onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                placeholder="you@example.com"
                autoComplete="email"
              />

              <Field
                label="Password"
                type="password"
                value={form.password}
                onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                placeholder="At least 8 characters"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />

              {error && (
                <div className="rounded-2xl border border-[#ff5f7a]/25 bg-[#ff5f7a]/10 px-4 py-3 text-sm text-[#ffd1db]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-gradient-to-r from-[#693def] to-[#8a63ff] px-5 py-4 text-base font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-[0_18px_44px_rgba(105,61,239,0.35)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Working...
                  </span>
                ) : mode === "signin" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-[#6b6287]">
              <div className="h-px flex-1 bg-white/10" />
              Optional
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="space-y-3">
              {oauthUrl && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = oauthUrl;
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-medium text-white transition-all hover:bg-white/10"
                >
                  Continue with Kimi
                </button>
              )}

              {import.meta.env.DEV && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    devLoginMutation.mutate();
                  }}
                  className="w-full rounded-2xl border border-dashed border-[#8a63ff]/40 bg-[#8a63ff]/10 px-5 py-4 text-sm font-medium text-[#e5dcff] transition-all hover:bg-[#8a63ff]/15"
                >
                  Dev admin shortcut
                </button>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-[#948bab]">
              {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
              <Link
                to={mode === "signin" ? "/signup" : "/login"}
                className="font-semibold text-[#c8baff] hover:text-white"
              >
                {mode === "signin" ? "Create one" : "Sign in"}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#a39abf]">{text}</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#d9d3ef]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-2xl border border-white/10 bg-[#0d0a18] px-4 py-3.5 text-white placeholder:text-[#70678d] outline-none transition-all focus:border-[#8a63ff] focus:ring-2 focus:ring-[#8a63ff]/20"
      />
    </label>
  );
}
