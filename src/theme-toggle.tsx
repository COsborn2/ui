"use client";

import type { ComponentPropsWithRef } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type ThemePreference = "system" | "light" | "dark";

export interface ThemeToggleProps extends Omit<ComponentPropsWithRef<"div">, "onChange"> {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
  disabled?: boolean;
  labels?: Partial<Record<ThemePreference, string>>;
}

const modes = [
  { value: "system", label: "System theme", Icon: Monitor },
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
] as const;

/** A controlled preference selector. The application applies and persists the theme. */
export function ThemeToggle({ value, onChange, disabled, labels, className, "aria-label": ariaLabel = "Theme", ...props }: ThemeToggleProps) {
  return (
    <div {...props} role="group" aria-label={ariaLabel} className={["bnh-theme-toggle", className].filter(Boolean).join(" ")}>
      {modes.map(({ value: mode, label, Icon }) => (
        <button key={mode} type="button" disabled={disabled} aria-pressed={value === mode}
          aria-label={labels?.[mode] ?? label} title={labels?.[mode] ?? label}
          onClick={() => onChange(mode)}>
          <Icon aria-hidden="true" size={14} />
        </button>
      ))}
    </div>
  );
}
