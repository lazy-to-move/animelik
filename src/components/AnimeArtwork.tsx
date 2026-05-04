import { useState } from "react";
import { ImageOff } from "lucide-react";

type AnimeArtworkProps = {
  src?: string | null;
  alt: string;
  title?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

function getInitials(title?: string | null): string {
  if (!title) return "NA";

  const parts = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "NA";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export default function AnimeArtwork({
  src,
  alt,
  title,
  className = "",
  imageClassName = "",
  fallbackClassName = "",
}: AnimeArtworkProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasError = Boolean(src && failedSrc === src);

  if (src && !hasError) {
    return (
      <img
        key={src}
        src={src}
        alt={alt}
        className={`${className} ${imageClassName}`.trim()}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return (
    <div
      className={`${className} ${fallbackClassName} flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(130,87,242,0.35),_transparent_48%),linear-gradient(160deg,_rgba(18,16,29,0.98),_rgba(5,4,10,1))]`.trim()}
      aria-label={alt}
      role="img"
    >
      <div className="flex flex-col items-center justify-center px-4 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#9f7aea]">
          <ImageOff className="h-6 w-6" />
        </div>
        <div className="mb-1 text-2xl font-bold tracking-[0.25em] text-white/90">
          {getInitials(title)}
        </div>
        <div className="max-w-[12rem] text-xs uppercase tracking-[0.3em] text-white/45">
          Poster unavailable
        </div>
      </div>
    </div>
  );
}
