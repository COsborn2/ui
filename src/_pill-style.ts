import type { CSSProperties } from "react";

interface PillAppearance {
  tint?: string;
  background?: string;
  borderColor?: string;
  height?: number;
}

/** Per-instance values travel as custom properties so stylesheets keep control of the properties themselves. */
export function pillStyle({ tint, background, borderColor, height }: PillAppearance, style?: CSSProperties): CSSProperties {
  return {
    "--bnh-pill-background": background ?? (tint ? `color-mix(in oklch, ${tint} 8%, transparent)` : undefined),
    "--bnh-pill-border-color": borderColor ?? (tint ? `color-mix(in oklch, ${tint} 30%, transparent)` : undefined),
    "--bnh-pill-height": height === undefined ? undefined : `${height}px`,
    ...style,
  } as CSSProperties;
}
