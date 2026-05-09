import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CalendarDays, Clock3, Globe, Loader2, Sparkles } from "lucide-react";
import AnimeArtwork from "@/components/AnimeArtwork";
import { trpc } from "@/lib/trpc";

function normalizeAnimeSlug(slug?: string | null) {
  return (slug ?? "").replace(/^\/+|\/+$/g, "");
}

const weekdayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type WeekdayKey = (typeof weekdayOrder)[number];

const weekdayIndexMap: Record<WeekdayKey, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

type ScheduleAnime = {
  id: number;
  title: string;
  titleEnglish: string | null;
  titleJp: string | null;
  slug: string;
  coverImage: string | null;
  score: string | null;
  releaseYear: number | null;
  episodesCount: number | null;
  categoryName: string | null;
  broadcastTime: string | null;
  broadcastTimezone: string | null;
  broadcastText: string | null;
};

export default function Schedule() {
  const { data, isLoading } = trpc.schedule.weekly.useQuery(undefined, {
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [selectedDay, setSelectedDay] = useState<WeekdayKey | "all">("all");

  const todayKey = useMemo<WeekdayKey>(() => {
    const today = new Date().getDay();
    return weekdayOrder.find((key) => weekdayIndexMap[key] === today) ?? "monday";
  }, []);

  const days = data?.days ?? [];
  const selectedDayGroup = selectedDay === "all"
    ? null
    : days.find((day) => day.key === selectedDay);

  return (
    <div className="min-h-screen bg-[#030209] px-4 pb-20 pt-[150px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#693def]/20 bg-[#693def]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-[#a78bfa]">
              <CalendarDays className="h-3.5 w-3.5" />
              Weekly Drop Calendar
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Anime Schedule</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[#9890b3] sm:text-base">
              Track your ongoing anime by release day using your Synx library plus Jikan broadcast data from MyAnimeList.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Tracked" value={data?.total ?? 0} />
            <StatCard label="Today" value={days.find((day) => day.key === todayKey)?.items.length ?? 0} />
            <StatCard label="Days Used" value={days.filter((day) => day.items.length > 0).length} />
            <StatCard label="Unscheduled" value={data?.unscheduled.length ?? 0} />
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <FilterChip
            active={selectedDay === "all"}
            onClick={() => setSelectedDay("all")}
            label="All Days"
            count={data?.total ?? 0}
          />
          {days.map((day) => (
            <FilterChip
              key={day.key}
              active={selectedDay === day.key}
              onClick={() => setSelectedDay(day.key)}
              label={day.label}
              count={day.items.length}
              highlight={day.key === todayKey}
            />
          ))}
        </div>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-white">
              <Loader2 className="h-5 w-5 animate-spin text-[#a78bfa]" />
              Loading weekly schedule...
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {selectedDayGroup ? (
              <ScheduleDaySection
                day={selectedDayGroup.label}
                items={selectedDayGroup.items}
                isToday={selectedDayGroup.key === todayKey}
              />
            ) : (
              days
                .filter((day) => day.items.length > 0)
                .map((day) => (
                  <ScheduleDaySection
                    key={day.key}
                    day={day.label}
                    items={day.items}
                    isToday={day.key === todayKey}
                  />
                ))
            )}

            {selectedDay === "all" && (data?.unscheduled.length ?? 0) > 0 && (
              <ScheduleDaySection
                day="Unscheduled"
                items={data?.unscheduled ?? []}
                isToday={false}
                description="These ongoing anime are in your library, but Jikan did not return a weekly broadcast day yet."
              />
            )}

            {!isLoading && data && data.total === 0 && (
              <div className="rounded-[36px] border border-white/10 bg-white/[0.03] px-8 py-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#693def]/15 text-[#a78bfa]">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-black text-white">No ongoing anime yet</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#958daf]">
                  Import or update some currently airing anime with MyAnimeList IDs, and this page will group them by release day automatically.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8279a5]">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  highlight = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
        active
          ? "border-[#8c72ff]/40 bg-[#693def] text-white shadow-[0_12px_30px_rgba(105,61,239,0.28)]"
          : highlight
            ? "border-[#8c72ff]/20 bg-[#693def]/10 text-[#d8ccff] hover:border-[#8c72ff]/40 hover:bg-[#693def]/15"
            : "border-white/10 bg-white/[0.03] text-[#bab2d7] hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      {label}
      <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-white/15 text-white" : "bg-white/10 text-[#dad2f0]"}`}>
        {count}
      </span>
    </button>
  );
}

function ScheduleDaySection({
  day,
  items,
  isToday,
  description,
}: {
  day: string;
  items: ScheduleAnime[];
  isToday: boolean;
  description?: string;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight text-white">{day}</h2>
            {isToday && (
              <span className="rounded-full border border-[#8c72ff]/30 bg-[#693def]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#b9a8ff]">
                Today
              </span>
            )}
          </div>
          {description ? (
            <p className="mt-2 text-sm text-[#958daf]">{description}</p>
          ) : (
            <p className="mt-2 text-sm text-[#958daf]">{items.length} anime scheduled</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/anime/${normalizeAnimeSlug(item.slug)}`}
            className="group rounded-[32px] border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:shadow-[0_20px_40px_rgba(0,0,0,0.22)]"
          >
            <div className="flex gap-4">
              <AnimeArtwork
                src={item.coverImage}
                alt={item.title}
                title={item.title}
                className="h-[136px] w-[96px] shrink-0 rounded-[24px]"
                imageClassName="h-[136px] w-[96px] rounded-[24px] object-cover"
                fallbackClassName="h-[136px] w-[96px] rounded-[24px]"
              />

              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-lg font-black leading-tight text-white transition-colors group-hover:text-[#cdbfff]">
                  {item.title}
                </h3>
                {item.titleEnglish && item.titleEnglish !== item.title && (
                  <p className="mt-1 line-clamp-1 text-sm text-[#938aac]">{item.titleEnglish}</p>
                )}

                <div className="mt-4 space-y-2 text-sm text-[#d6d0ea]">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-[#9d8ee4]" />
                    <span>{item.broadcastTime || "Time not listed"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[#9d8ee4]" />
                    <span className="line-clamp-1">{item.broadcastTimezone || item.broadcastText || "Broadcast info from Jikan"}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d84ad]">
                  {item.categoryName && (
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1">{item.categoryName}</span>
                  )}
                  {item.releaseYear && (
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1">{item.releaseYear}</span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-[#f0c75e]">
                  <span>{item.score ? `${item.score} score` : "No score"}</span>
                  <span className="text-[#8f86ab]">{item.episodesCount ? `${item.episodesCount} eps` : "Ongoing"}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
