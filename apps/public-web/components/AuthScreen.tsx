"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AuthMode = "signin" | "signup";

type AuthScreenProps = {
  mode: AuthMode;
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
};

function validateAuthForm(mode: AuthMode, form: typeof emptyForm) {
  if (mode === "signup") {
    const name = form.name.trim();
    if (name.length < 2) return "Use at least 2 characters for your name.";
    if (name.length > 60) return "Names must be 60 characters or less.";
  }

  const email = form.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }

  if (form.password.length < 8) {
    return "Use at least 8 characters for your password.";
  }

  if (form.password.length > 72) {
    return "Passwords must be 72 characters or less.";
  }

  return "";
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">{mode === "signin" ? "Sign In" : "Create Account"}</div>
        <h1 className="auth-title">
          {mode === "signin" ? "Welcome back" : "Create your Synx account"}
        </h1>
        <p className="muted auth-copy">
          {mode === "signin"
            ? "Use your email and password to access your watchlist and progress."
            : "Create a site account to save anime, track progress, and move into the new public app gradually."}
        </p>

        <div className="auth-mode-row">
          <Link
            href="/login"
            className={`auth-mode-link${mode === "signin" ? " active" : ""}`}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className={`auth-mode-link${mode === "signup" ? " active" : ""}`}
          >
            Sign Up
          </Link>
        </div>

        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const validationError = validateAuthForm(mode, form);
            if (validationError) {
              setError(validationError);
              return;
            }

            setIsSubmitting(true);
            try {
              const response = await fetch(
                mode === "signin" ? "/api/auth/sign-in" : "/api/auth/sign-up",
                {
                  method: "POST",
                  credentials: "same-origin",
                  headers: {
                    "content-type": "application/json",
                  },
                  body: JSON.stringify(
                    mode === "signin"
                      ? {
                          email: form.email.trim(),
                          password: form.password,
                        }
                      : {
                          name: form.name.trim(),
                          email: form.email.trim(),
                          password: form.password,
                        },
                  ),
                },
              );

              if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as
                  | { error?: string }
                  | null;
                throw new Error(payload?.error || "Authentication failed.");
              }

              router.refresh();
              router.push("/watchlist");
            } catch (submissionError) {
              setError(
                submissionError instanceof Error
                  ? submissionError.message
                  : "Authentication failed.",
              );
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {mode === "signup" && (
            <label className="auth-field">
              <span>Display name</span>
              <input
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Your name"
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="you@example.com"
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder={
                mode === "signin"
                  ? "Your password"
                  : "At least 8 characters"
              }
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="button primary auth-submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Working..."
              : mode === "signin"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>
      </section>
    </main>
  );
}
