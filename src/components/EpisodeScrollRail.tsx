import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

type EpisodeScrollRailProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  itemCount: number;
  footerText?: string;
};

export default function EpisodeScrollRail({
  containerRef,
  itemCount,
  footerText,
}: EpisodeScrollRailProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [thumbRatio, setThumbRatio] = useState(0.22);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncScrollState = () => {
      const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
      const hasOverflow = maxScroll > 8;
      setCanScroll(hasOverflow);

      if (!hasOverflow) {
        setScrollProgress(0);
        setThumbRatio(1);
        return;
      }

      const visibleRatio = container.clientHeight / container.scrollHeight;
      setScrollProgress(container.scrollTop / maxScroll);
      setThumbRatio(Math.min(Math.max(visibleRatio, 0.18), 0.6));
    };

    syncScrollState();
    container.addEventListener("scroll", syncScrollState, { passive: true });
    window.addEventListener("resize", syncScrollState);

    return () => {
      container.removeEventListener("scroll", syncScrollState);
      window.removeEventListener("resize", syncScrollState);
    };
  }, [containerRef, itemCount]);

  const scrollToRatio = useCallback((ratio: number) => {
    const container = containerRef.current;
    if (!container) return;

    const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
    if (maxScroll <= 0) return;

    const clampedRatio = Math.min(Math.max(ratio, 0), 1);
    container.scrollTop = maxScroll * clampedRatio;
  }, [containerRef]);

  const scrollFromPointer = useCallback((clientY: number, dragOffset: number) => {
    const track = trackRef.current;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const thumbHeight = rect.height * thumbRatio;
    const maxThumbTravel = Math.max(rect.height - thumbHeight, 1);
    const nextTop = Math.min(Math.max(clientY - rect.top - dragOffset, 0), maxThumbTravel);
    scrollToRatio(nextTop / maxThumbTravel);
  }, [scrollToRatio, thumbRatio]);

  useEffect(() => {
    if (!canScroll) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (dragOffsetRef.current === null) return;
      scrollFromPointer(event.clientY, dragOffsetRef.current);
    };

    const stopDragging = () => {
      dragOffsetRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, [canScroll, scrollFromPointer]);

  if (!canScroll) return null;

  const thumbHeightPercent = thumbRatio * 100;
  const thumbTopPercent = scrollProgress * (100 - thumbHeightPercent);
  const resolvedFooterText = footerText ?? `${itemCount} items`;

  return (
    <div className="flex min-h-[220px] w-11 shrink-0 select-none flex-col items-center gap-3 self-stretch rounded-[1.5rem] border border-white/8 bg-white/[0.035] px-1.5 py-4 sm:w-14 sm:rounded-[2rem] sm:px-2">
      <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[#8b82aa] sm:text-[10px]">Scroll</span>

      <div
        ref={trackRef}
        onPointerDown={(event) => {
          const track = trackRef.current;
          if (!track) return;
          const rect = track.getBoundingClientRect();
          const thumbHeight = rect.height * thumbRatio;
          const centeredOffset = thumbHeight / 2;
          dragOffsetRef.current = centeredOffset;
          scrollFromPointer(event.clientY, centeredOffset);
        }}
        className="relative w-3.5 flex-1 cursor-pointer touch-none rounded-full bg-[#120f1d] ring-1 ring-white/10 sm:w-4"
      >
        <div className="absolute inset-[3px] rounded-full bg-[linear-gradient(180deg,rgba(105,61,239,0.12),rgba(105,61,239,0.02))]" />
        <div
          onPointerDown={(event) => {
            event.stopPropagation();
            const track = trackRef.current;
            if (!track) return;
            const rect = track.getBoundingClientRect();
            const thumbHeight = rect.height * thumbRatio;
            const maxThumbTravel = rect.height - thumbHeight;
            const currentThumbTop = rect.top + maxThumbTravel * scrollProgress;
            dragOffsetRef.current = event.clientY - currentThumbTop;
          }}
          className="absolute left-1/2 w-2.5 touch-none -translate-x-1/2 rounded-full bg-[#8257f2] shadow-[0_0_18px_rgba(105,61,239,0.45)] sm:w-3"
          style={{
            top: `${thumbTopPercent}%`,
            height: `${thumbHeightPercent}%`,
          }}
        />
      </div>

      <span className="text-center text-[9px] font-bold text-[#cfc7ec] sm:text-[10px]">{resolvedFooterText}</span>
    </div>
  );
}
