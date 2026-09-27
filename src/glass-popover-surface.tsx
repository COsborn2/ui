import { createElement, type ComponentPropsWithoutRef, type ReactElement, type Ref } from "react";

export type GlassPopoverSurfaceProps = (
  | ({ as?: "div" } & ComponentPropsWithoutRef<"div">)
  | ({ as: "button" } & ComponentPropsWithoutRef<"button">)
) & { ref?: Ref<HTMLDivElement | HTMLButtonElement> };

export function GlassPopoverSurface({ as = "div", className, ...props }: GlassPopoverSurfaceProps): ReactElement {
  return createElement(as, { ...props, className: ["bnh-glass-popover", className].filter(Boolean).join(" ") });
}
