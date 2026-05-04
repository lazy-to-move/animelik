import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Loader2, Tv } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";

type AuthMode = "signin" | "signup";

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void;
        };
      };
    };
  }
}

const emptyForm = {
  name: "",
  email: "",
  password: "",
};

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const mode: AuthMode = location.pathname === "/signup" ? "signup" : "signin";

  const utils = trpc.useUtils();

  const signInMutation = trpc.auth.signIn.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const signUpMutation = trpc.auth.signUp.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const googleSignInMutation = trpc.auth.googleSignIn.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const mountGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          const credential = response.credential;
          if (!credential) {
            setError("Google sign-in did not return a credential.");
            return;
          }
          setError("");
          googleSignInMutation.mutate({ credential });
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: mode === "signin" ? "signin_with" : "signup_with",
        width: "320",
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
    if (existingScript && window.google?.accounts?.id) {
      mountGoogleButton();
      return;
    }

    const script = existingScript ?? document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = mountGoogleButton;

    if (!existingScript) {
      document.head.appendChild(script);
    }
  }, [googleClientId, googleSignInMutation, mode]);

  const isSubmitting = signInMutation.isPending || signUpMutation.isPending || googleSignInMutation.isPending;

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
    setForm(emptyForm);
    setError("");
    navigate(nextMode === "signin" ? "/login" : "/signup");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05030d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(103,65,246,0.24),_transparent_30%),radial-gradient(circle_at_bottom,_rgba(27,120,255,0.08),_transparent_30%)]" />
      <div className="absolute inset-x-0 top-0 h-[220px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <div className="rounded-[30px] border border-white/10 bg-[#0f0b1c]/92 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#693def] to-[#8a63ff] shadow-[0_18px_40px_rgba(105,61,239,0.35)]">
                <Tv className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-black tracking-tight">Synx</div>
                <div className="text-xs uppercase tracking-[0.24em] text-[#8e84ae]">Account</div>
              </div>
            </Link>

            <div className="mt-8">
              <Link
                to="/"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#9a93b6] transition-colors hover:border-white/20 hover:text-white"
              >
                Back to site
              </Link>
              <h1 className="text-3xl font-black tracking-tight">
                {mode === "signin" ? "Sign in" : "Create account"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#9b93b8]">
                {mode === "signin"
                  ? "Use your site account to access watchlists, reviews, and your saved progress."
                  : "Create a site-owned account with email and password."}
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5">
              <ModeButton active={mode === "signin"} onClick={() => switchMode("signin")}>
                Sign In
              </ModeButton>
              <ModeButton active={mode === "signup"} onClick={() => switchMode("signup")}>
                Sign Up
              </ModeButton>
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
                placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />

              {error && (
                <div className="rounded-2xl border border-[#ff6a88]/20 bg-[#ff6a88]/10 px-4 py-3 text-sm text-[#ffd7df]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#693def] to-[#8a63ff] px-5 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(105,61,239,0.32)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Working...
                  </span>
                ) : mode === "signin" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            {googleClientId && (
              <>
                <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[#70698b]">
                  <div className="h-px flex-1 bg-white/10" />
                  Or continue with
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="flex justify-center">
                  <div ref={googleButtonRef} />
                </div>
              </>
            )}

            <p className="mt-6 text-center text-sm text-[#968eb2]">
              {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
              <Link
                to={mode === "signin" ? "/signup" : "/login"}
                className="font-semibold text-[#d3c9ff] transition-colors hover:text-white"
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

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
        active
          ? "bg-[#6d45f4] text-white shadow-[0_12px_28px_rgba(109,69,244,0.3)]"
          : "text-[#958caf] hover:text-white"
      }`}
    >
      {children}
    </button>
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
      <span className="mb-2 block text-sm font-medium text-[#d9d4ed]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="h-14 w-full rounded-2xl border border-white/10 bg-[#151025] px-4 text-white [caret-color:#ffffff] [-webkit-text-fill-color:#ffffff] placeholder:text-[#8d86a8] placeholder:font-normal outline-none transition-all focus:border-[#8c72ff] focus:ring-2 focus:ring-[#8c72ff]/20"
      />
    </label>
  );
}
