import Link from "next/link";
import { AnimeImage } from "../../components/AnimeImage";
import { getScheduleCatalogData } from "../../lib/catalog-source";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Weekly Schedule",
  description:
    "Server-rendered schedule page powered by shared Synx schedule services during migration.",
};

export default async function SchedulePage() {
  const data = await getScheduleCatalogData();

  return (
    <main className="section">
      <div className="container">
        <div className="panel" style={{ borderRadius: 28, padding: 24, marginBottom: 24 }}>
          <h1 style={{ marginTop: 0 }}>Weekly Schedule</h1>
          <p className="muted">
            This page is server-rendered in Next.js while reusing the shared
            schedule logic directly when database access is available.
          </p>
        </div>

        <div className="schedule-grid">
          {data.days
            .filter((day) => day.items.length > 0)
            .map((day) => (
              <section key={day.key} className="panel schedule-day">
                <h2 style={{ marginTop: 0 }}>{day.label}</h2>
                <div className="grid anime-grid">
                  {day.items.map((item) => (
                    <Link key={item.id} href={`/anime/${item.slug}`} className="card">
                      <AnimeImage
                        src={item.coverImage}
                        alt={item.title}
                        sizes="(min-width: 1180px) 220px, (min-width: 768px) 33vw, 100vw"
                        frameClassName="poster-media"
                      />
                      <div className="card-copy">
                        <h3>{item.title}</h3>
                        <p className="muted">
                          {item.broadcastTime || "Time not listed"} | {item.score ? `${item.score} score` : "No score"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>
      </div>
    </main>
  );
}
