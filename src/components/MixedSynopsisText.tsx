import type { CSSProperties, ReactNode } from "react";

type MixedSynopsisTextProps = {
  children: ReactNode;
  className?: string;
  as?: "p" | "div" | "span";
  preserveLines?: boolean;
};

const mixedTextStyle: CSSProperties = {
  unicodeBidi: "plaintext",
  textAlign: "start",
};

export default function MixedSynopsisText({
  children,
  className = "",
  as = "p",
  preserveLines = false,
}: MixedSynopsisTextProps) {
  const Component = as;

  return (
    <Component
      dir="auto"
      className={className}
      style={{
        ...mixedTextStyle,
        whiteSpace: preserveLines ? "pre-line" : undefined,
      }}
    >
      {children}
    </Component>
  );
}
