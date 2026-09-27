"use client";

import { useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { PILL_HEIGHT, type PillProps } from "./pill.js";

export interface ExpandablePillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">, Pick<PillProps, "tint" | "background" | "borderColor" | "height"> {
  panel: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  panelGap?: number;
  panelMaxWidth?: number | string;
  panelAlign?: "end" | "center";
}

export function ExpandablePill({
  tint,
  background,
  borderColor,
  height = PILL_HEIGHT,
  panel,
  open,
  defaultOpen = false,
  onOpenChange,
  panelGap = 6,
  panelMaxWidth = "calc(100vw - 32px)",
  panelAlign = "end",
  style,
  className,
  children,
  onClick,
  onKeyDown,
  type = "button",
  ...props
}: ExpandablePillProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const isOpen = open ?? internalOpen;
  const centered = panelAlign === "center";
  function changeOpen(value: boolean) {
    if (open === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  }
  return (
    <span
      className="bnh-expandable-pill"
      style={{ position: centered ? "static" : "relative" }}
      onKeyDown={(event) => {
        // Portaled widgets remain in this React subtree, but own their keyboard
        // interaction. A nested disclosure can also consume Escape first.
        if (event.defaultPrevented || event.key !== "Escape" || !isOpen
          || !event.currentTarget.contains(event.target as Node)) return;
        event.preventDefault();
        event.stopPropagation();
        changeOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        {...props}
        ref={triggerRef}
        type={type}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={["bnh-pill", "bnh-expandable-pill-trigger", className].filter(Boolean).join(" ")}
        style={{
          height,
          whiteSpace: "nowrap",
          background: background ?? (tint ? `color-mix(in oklch, ${tint} 8%, transparent)` : "transparent"),
          border: `1px solid ${borderColor ?? (tint ? `color-mix(in oklch, ${tint} 30%, transparent)` : "var(--bnh-border)")}`,
          ...style,
        }}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) changeOpen(!isOpen);
        }}
        onKeyDown={onKeyDown}
      >
        {children}
      </button>
      <div
        id={panelId}
        className="bnh-expandable-pill-panel"
        inert={!isOpen}
        aria-hidden={!isOpen}
        style={{
          top: `calc(100% + ${panelGap}px)`,
          ...(centered
            ? { left: 16, right: 16, display: "flex", justifyContent: "center" }
            : { right: 0, maxWidth: panelMaxWidth }),
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transform: isOpen ? "translateY(0) scale(1)" : "translateY(-4px) scale(.98)",
          transformOrigin: centered ? "top center" : "top right",
          visibility: isOpen ? "visible" : "hidden",
        }}
      >
        {panel}
      </div>
    </span>
  );
}
