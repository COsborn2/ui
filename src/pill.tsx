import type { CSSProperties, HTMLAttributes } from "react";

export const PILL_HEIGHT = 26;

export interface PillProps extends HTMLAttributes<HTMLElement> {
  tint?: string;
  background?: string;
  borderColor?: string;
  height?: number;
  as?: "span" | "div";
  style?: CSSProperties;
}

/** A static status surface. Use ExpandablePill for a disclosure. */
export function Pill({
  tint,
  background,
  borderColor,
  height = PILL_HEIGHT,
  as: Tag = "span",
  style,
  className,
  ...props
}: PillProps) {
  return (
    <Tag
      className={["bnh-pill", className].filter(Boolean).join(" ")}
      style={{
        height,
        whiteSpace: "nowrap",
        background: background ?? (tint ? `color-mix(in oklch, ${tint} 8%, transparent)` : undefined),
        border: `1px solid ${borderColor ?? (tint ? `color-mix(in oklch, ${tint} 30%, transparent)` : "var(--bnh-border)")}`,
        ...style,
      }}
      {...props}
    />
  );
}
