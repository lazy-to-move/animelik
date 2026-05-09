import { Link } from "react-router";

const sections = [
  {
    title: "Information we store",
    body:
      "Synx stores the account information required to sign in, maintain watchlists, save reviews, and track viewing progress. Operational logs and rate-limit counters may also be collected to keep the service stable and secure.",
  },
  {
    title: "How cookies are used",
    body:
      "The platform uses an HTTP-only session cookie to keep users signed in. These cookies are not intended for ad tracking and are used only for authentication and security-sensitive site behavior.",
  },
  {
    title: "Imported content and metadata",
    body:
      "Anime details, schedules, episode links, and artwork may be imported from supported external sources. External sources remain responsible for the accuracy and ownership of the metadata they publish.",
  },
  {
    title: "Security and retention",
    body:
      "Password-based accounts store hashed passwords instead of plaintext secrets. Access logs, moderation data, and broken-source reports may be retained for abuse prevention, troubleshooting, and operations.",
  },
  {
    title: "Contact and requests",
    body:
      "If you need a correction or removal request, contact the site operator through the published support channel before relying on third-party mirrors or scraped contact details.",
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#030209] px-4 pb-16 pt-[150px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,14,31,0.96),rgba(8,7,14,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#9d7cff]">Legal</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#a6a1bb] sm:text-lg">
            This summary covers the operational privacy expectations for Synx Anime in its current release. It is written to help users understand the product behavior before a more formal policy is published.
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
              to="/terms"
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              View Terms
            </Link>
            <Link
              to="/settings"
              className="rounded-full border border-[#693def]/20 bg-[#693def]/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-[#693def]/15"
            >
              Account Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
