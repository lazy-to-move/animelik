import { Link } from "react-router";

const sections = [
  {
    title: "Acceptable use",
    body:
      "Users must not abuse the platform, disrupt imports, flood reports, attempt unauthorized access, or use the service to automate attacks against external sources or the Synx infrastructure.",
  },
  {
    title: "Accounts and moderation",
    body:
      "Accounts may be suspended or removed if they are used for spam, impersonation, harassment, or attempts to bypass administrative controls and rate limits.",
  },
  {
    title: "Third-party content sources",
    body:
      "Synx may surface metadata or embedded players from third-party providers. Availability, legality, uptime, and playback behavior of those external sources are not guaranteed by the site itself.",
  },
  {
    title: "Operational changes",
    body:
      "Features such as imports, source syncing, reviews, and dashboards may change, pause, or be restricted when needed for stability, compliance, or abuse prevention.",
  },
  {
    title: "Limitation of service",
    body:
      "The service is provided on an as-available basis. Operators should still maintain backups, monitor deployments, and validate imported data because scraped content pipelines can fail without warning.",
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#030209] px-4 pb-16 pt-[150px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,14,31,0.96),rgba(8,7,14,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#9d7cff]">Legal</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#a6a1bb] sm:text-lg">
            These launch-stage terms explain the expected rules for using Synx Anime and the boundaries around scraped content, accounts, and site operations.
          </p>
          <p className="mt-3 text-sm text-[#7f789a]">Last updated: May 9, 2026</p>

          <div className="mt-8 space-y-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5"
              >
                <h2 className="text-xl font-black text-white">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[#c2bdd4]">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/privacy"
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              View Privacy Policy
            </Link>
            <Link
              to="/browse"
              className="rounded-full border border-[#693def]/20 bg-[#693def]/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-[#693def]/15"
            >
              Back to Browse
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
