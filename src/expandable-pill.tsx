"use client";

import { useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { pillStyle } from "./_pill-style.js";
import type { PillProps } from "./pill.js";

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
  height,
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
  function changeOpen(value: boolean) {
    if (open === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  }
  return (
    <span
      className="bnh-expandable-pill"
      data-align={panelAlign}
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
        style={pillStyle({ tint, background, borderColor, height }, style)}
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
        data-align={panelAlign}
        data-state={isOpen ? "open" : "closed"}
        inert={!isOpen}
        aria-hidden={!isOpen}
        style={{
          "--bnh-expandable-pill-gap": `${panelGap}px`,
          "--bnh-expandable-pill-panel-max-width": typeof panelMaxWidth === "number" ? `${panelMaxWidth}px` : panelMaxWidth,
        } as CSSProperties}
      >
        {panel}
      </div>
    </span>
  );
}
