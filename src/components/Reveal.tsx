import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type RevealDirection = "up" | "left" | "right" | "scale" | "none";

const directionStyles: Record<RevealDirection, CSSProperties> = {
  up: {
    opacity: 0,
    transform: "translate3d(0, 24px, 0)",
  },
  left: {
    opacity: 0,
    transform: "translate3d(-24px, 0, 0)",
  },
  right: {
    opacity: 0,
    transform: "translate3d(24px, 0, 0)",
  },
  scale: {
    opacity: 0,
    transform: "scale(0.96)",
  },
  none: {
    opacity: 0,
  },
};

const visibleStyles: CSSProperties = {
  opacity: 1,
  transform: "translate3d(0, 0, 0) scale(1)",
};

export default function Reveal({
  children,
  className,
  direction = "up",
  delayMs = 0,
  once = true,
  threshold = 0.2,
}: {
  children: ReactNode;
  className?: string;
  direction?: RevealDirection;
  delayMs?: number;
  once?: boolean;
  threshold?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    if (prefersReducedMotion) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [once, prefersReducedMotion, threshold]);

  return (
    <div
      ref={elementRef}
      className={className}
      style={{
        ...(prefersReducedMotion || isVisible ? visibleStyles : directionStyles[direction]),
        transition:
          "opacity 560ms cubic-bezier(0.22, 1, 0.36, 1), transform 560ms cubic-bezier(0.22, 1, 0.36, 1)",
        transitionDelay: `${delayMs}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
