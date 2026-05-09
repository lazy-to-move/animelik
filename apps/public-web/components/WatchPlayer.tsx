"use client";

import { useMemo, useState } from "react";
import { resolveMediaUrl } from "../lib/api";

type VideoQuality = "sd" | "hd" | "fhd";

type VideoSource = {
  server: string;
  quality: VideoQuality;
  url: string;
};

type WatchPlayerProps = {
  animeTitle: string;
  episodeTitle: string;
  fallbackPoster: string | null;
  videoUrl: string | null | undefined;
  videoSources: unknown;
};

const serverNames: Record<string, string> = {
  streamwish: "StreamWish",
  mp4upload: "MP4Upload",
  yonaplay: "YonaPlay",
  videa: "Videa",
  voe: "Voe",
  uqload: "Uqload",
  vkvideo: "VKVideo",
  fileupload: "File-Upload",
  share4max: "Share4Max",
  larhu: "Larhu",
  dsvplay: "DSVPlay",
  mega: "Mega.nz",
  fourShared: "4Shared",
  soraplay: "Soraplay",
};

const qualityOrder: VideoQuality[] = ["fhd", "hd", "sd"];
const qualityLabels: Record<VideoQuality, string> = {
  sd: "SD (480p)",
  hd: "HD (720p)",
  fhd: "FHD (1080p)",
};

function parseVideoSources(rawSources: unknown): VideoSource[] {
  try {
    const parsed =
      typeof rawSources === "string" ? JSON.parse(rawSources) : rawSources;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((source): source is VideoSource => {
      if (!source || typeof source !== "object") return false;
      const item = source as Partial<VideoSource>;
      return Boolean(
        typeof item.server === "string" &&
          typeof item.quality === "string" &&
          typeof item.url === "string" &&
          /^https?:\/\//i.test(item.url),
      );
    });
  } catch {
    return [];
  }
}

function sortServers(servers: string[]) {
  return servers.sort((left, right) => left.localeCompare(right));
}

export function WatchPlayer({
  animeTitle,
  episodeTitle,
  fallbackPoster,
  videoUrl,
  videoSources,
}: WatchPlayerProps) {
  const parsedVideoSources = useMemo(
    () => parseVideoSources(videoSources),
    [videoSources],
  );
  const [preferredServer, setPreferredServer] = useState<string>("");
  const [preferredQuality, setPreferredQuality] = useState<VideoQuality>("hd");

  const availableServers = useMemo(
    () =>
      sortServers(
        Array.from(
          new Set(parsedVideoSources.map((source) => source.server)),
        ),
      ),
    [parsedVideoSources],
  );

  const selectedServer =
    (preferredServer && availableServers.includes(preferredServer)
      ? preferredServer
      : availableServers[0]) ?? "";

  const filteredSources = selectedServer
    ? parsedVideoSources.filter((source) => source.server === selectedServer)
    : parsedVideoSources;

  const availableQualities = qualityOrder.filter((quality) =>
    filteredSources.some((source) => source.quality === quality),
  );

  const selectedQuality =
    availableQualities.includes(preferredQuality)
      ? preferredQuality
      : (availableQualities[0] ?? "hd");

  const selectedSource =
    filteredSources.find((source) => source.quality === selectedQuality) ??
    filteredSources[0] ??
    null;

  const posterUrl = resolveMediaUrl(fallbackPoster);
  const playerTitle = `${animeTitle} - ${episodeTitle}`;

  return (
    <section className="watch-player-shell">
      <div className="watch-player-frame">
        {selectedSource?.url ? (
          <iframe
            src={selectedSource.url}
            className="watch-player-embed"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            title={playerTitle}
          />
        ) : videoUrl ? (
          <video
            src={videoUrl}
            controls
            className="watch-player-embed"
            poster={posterUrl ?? undefined}
          />
        ) : (
          <div className="watch-player-empty">
            <div>
              <p className="eyebrow">No stream yet</p>
              <h2>{episodeTitle}</h2>
              <p className="muted">
                This episode is present in the catalog, but no playable source is
                attached yet.
              </p>
            </div>
          </div>
        )}
      </div>

      {parsedVideoSources.length > 0 && (
        <div className="watch-player-controls">
          <div className="watch-select-group">
            <label htmlFor="watch-server-select">Server</label>
            <select
              id="watch-server-select"
              value={selectedServer}
              onChange={(event) => setPreferredServer(event.target.value)}
            >
              {availableServers.map((server) => (
                <option key={server} value={server}>
                  {serverNames[server] ?? server}
                </option>
              ))}
            </select>
          </div>

          <div className="watch-select-group">
            <label htmlFor="watch-quality-select">Quality</label>
            <select
              id="watch-quality-select"
              value={selectedQuality}
              onChange={(event) =>
                setPreferredQuality(event.target.value as VideoQuality)
              }
            >
              {availableQualities.map((quality) => (
                <option key={quality} value={quality}>
                  {qualityLabels[quality]}
                </option>
              ))}
            </select>
          </div>

          {selectedSource?.url && (
            <a
              className="button"
              href={selectedSource.url}
              target="_blank"
              rel="noreferrer"
            >
              Open source
            </a>
          )}
        </div>
      )}
    </section>
  );
}
