"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/** Copy scoped tokens across a portal and follow changes to its source region. */
export function usePortalTheme(origin: RefObject<HTMLElement | null>, open: boolean, theme?: "light" | "dark", portalContainer?: HTMLElement | null) {
  const [tokens, setTokens] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    const marker = origin.current;
    if (!open || !marker) return;
    const view = marker.ownerDocument.defaultView;
    if (!view) return;
    const update = () => {
      const computed = view.getComputedStyle(marker);
      const values: Record<string, string> = {};
      for (let index = 0; index < computed.length; index++) {
        const name = computed.item(index);
        if (name.startsWith("--bnh-")) values[name] = computed.getPropertyValue(name);
      }
      setTokens((previous) => {
        const old = previous as Record<string, string>;
        return Object.keys(old).length === Object.keys(values).length && Object.entries(values).every(([key, value]) => old[key] === value)
          ? previous : values as CSSProperties;
      });
    };
    update();
    const observer = new view.MutationObserver(update);
    for (let ancestor: HTMLElement | null = marker; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ["class", "style", "data-bnh-theme"] });
    }
    return () => observer.disconnect();
  }, [open, origin, theme, portalContainer]);
  return tokens;
}
