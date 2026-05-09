import { Link } from "react-router";
import { ArrowRight, LogOut, Shield, Sparkles, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { user, isAdmin, isLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
  });

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030209] pt-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#693def] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030209] px-4 pb-16 pt-[150px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(105,61,239,0.18),transparent_38%),linear-gradient(180deg,rgba(18,14,31,0.96),rgba(8,7,14,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#693def]/25 bg-[#693def]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#9d7cff]">
                <Sparkles className="h-4 w-4" />
                Account Center
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                Settings
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-[#a6a1bb] sm:text-lg">
                Review your profile, confirm your account role, and access the places you manage most often without digging through the site.
              </p>
            </div>

            <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white">
              <img
                src={user.avatar || "/avatars/user1.jpg"}
                alt={user.name || "User avatar"}
                className="h-12 w-12 rounded-full object-cover ring-1 ring-white/10"
              />
              <div>
                <p className="font-black">{user.name || "User"}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8d84ad]">
                  {isAdmin ? "Administrator" : "Member"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_55px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[#9d7cff]">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Profile</h2>
                <p className="text-sm text-[#8f88aa]">Core account details available in this release.</p>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <dt className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6e6787]">Name</dt>
                <dd className="mt-2 text-lg font-bold text-white">{user.name || "Not set"}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <dt className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6e6787]">Email</dt>
                <dd className="mt-2 break-all text-lg font-bold text-white">{user.email || "Unavailable"}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <dt className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6e6787]">Role</dt>
                <dd className="mt-2 text-lg font-bold text-white">{isAdmin ? "Admin" : "User"}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <dt className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6e6787]">Session</dt>
                <dd className="mt-2 text-lg font-bold text-white">Active on this device</dd>
              </div>
            </dl>
          </section>

          <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_55px_rgba(0,0,0,0.24)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[#9d7cff]">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Quick Access</h2>
                  <p className="text-sm text-[#8f88aa]">Jump to the most-used account destinations.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <Link
                  to="/watchlist"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/10"
                >
                  <span>Open Watchlist</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center justify-between rounded-2xl border border-[#693def]/20 bg-[#693def]/10 px-4 py-4 text-sm font-bold text-white transition hover:bg-[#693def]/15"
                  >
                    <span>Open Admin Dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <Link
                  to="/privacy"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/10"
                >
                  <span>Privacy Policy</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/terms"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/10"
                >
                  <span>Terms of Service</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-rose-500/20 bg-rose-500/[0.08] p-6 shadow-[0_20px_55px_rgba(0,0,0,0.24)]">
              <h2 className="text-xl font-black text-white">Session Control</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#f4d8df]">
                Password change and account deletion are not exposed in the UI yet, so the safe control available here is signing out from this device.
              </p>
              <button
                type="button"
                onClick={logout}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/20 px-5 py-3 text-sm font-black text-white transition hover:bg-rose-500/30"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
