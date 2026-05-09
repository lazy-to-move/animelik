import Image from "next/image";
import { resolveMediaUrl } from "../lib/api";

type AnimeImageProps = {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  frameClassName?: string;
  imageClassName?: string;
  fallbackLabel?: string;
};

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AnimeImage({
  src,
  alt,
  sizes,
  priority = false,
  frameClassName,
  imageClassName,
  fallbackLabel = "Poster unavailable",
}: AnimeImageProps) {
  const resolvedSrc = resolveMediaUrl(src);
  const useUnoptimizedImage = Boolean(
    resolvedSrc &&
      (resolvedSrc.endsWith(".svg") ||
        resolvedSrc.startsWith("http://127.0.0.1") ||
        resolvedSrc.startsWith("http://localhost")),
  );

  return (
    <div className={joinClasses("media-frame", frameClassName)}>
      {resolvedSrc ? (
        <Image
          src={resolvedSrc}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={joinClasses("media-image", imageClassName)}
          unoptimized={useUnoptimizedImage}
        />
      ) : (
        <div className="media-fallback">
          <span>{fallbackLabel}</span>
        </div>
      )}
    </div>
  );
}
