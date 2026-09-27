"use client";

import type { CSSProperties, ReactNode } from "react";

export interface SegmentedControlItem<T extends string = string> {
  id: T;
  label: string;
  accent?: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  items: SegmentedControlItem<T>[];
  value: T;
  onChange: (id: T) => void;
  "aria-label"?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({ items, value, onChange, "aria-label": ariaLabel, className }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={["bnh-segmented-control", className].filter(Boolean).join(" ")}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button key={item.id} type="button" onClick={() => onChange(item.id)} disabled={item.disabled} title={item.title} aria-pressed={active} className="bnh-segmented-control-item" style={{ "--bnh-segment-accent": item.accent ?? "var(--bnh-text-dim)" } as CSSProperties}>
            {item.icon}
            {item.accent && <span aria-hidden="true" className="bnh-segmented-control-dot" style={{ background: item.accent }} />}
            {item.label}
            {item.count !== undefined && <span className="bnh-segmented-control-count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
