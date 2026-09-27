import type { ComponentPropsWithRef } from "react";

export interface SurfaceProps extends ComponentPropsWithRef<"div"> {
  variant?: "raised" | "glass" | "frosted";
}

export function Surface({ variant = "raised", className, ...props }: SurfaceProps) {
  return <div {...props} className={["bnh-surface", `bnh-surface--${variant}`, className].filter(Boolean).join(" ")} />;
}

