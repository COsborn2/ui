import type { CSSProperties, HTMLAttributes } from "react";
import { pillStyle } from "./_pill-style.js";

export const PILL_HEIGHT = 26;

export interface PillProps extends HTMLAttributes<HTMLElement> {
  tint?: string;
  background?: string;
  borderColor?: string;
  /** Pixels; defaults to PILL_HEIGHT through `--bnh-pill-height`. */
  height?: number;
  as?: "span" | "div";
  style?: CSSProperties;
}

/** A static status surface. Use ExpandablePill for a disclosure. */
export function Pill({
  tint,
  background,
  borderColor,
  height,
  as: Tag = "span",
  style,
  className,
  ...props
}: PillProps) {
  return (
    <Tag
      className={["bnh-pill", className].filter(Boolean).join(" ")}
      style={pillStyle({ tint, background, borderColor, height }, style)}
      {...props}
    />
  );
}
