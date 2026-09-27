"use client";

import type { ComponentPropsWithRef } from "react";
import { Ban } from "lucide-react";

export interface ColorOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ColorPickerProps extends Omit<ComponentPropsWithRef<"div">, "onChange"> {
  value: string | null;
  onChange: (value: string | null) => void;
  colors: readonly ColorOption[];
  disabled?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
}

/** Palette, persistence, and the meaning of each color belong to the application. */
export function ColorPicker({ value, onChange, colors, disabled, allowNone = true, noneLabel = "None", className, "aria-label": ariaLabel = "Color", ...props }: ColorPickerProps) {
  return (
    <div {...props} role="group" aria-label={ariaLabel} className={["bnh-color-picker", className].filter(Boolean).join(" ")}>
      {allowNone && <button type="button" className="bnh-color-picker-none" disabled={disabled}
        title={noneLabel} aria-label={noneLabel} aria-pressed={value === null} onClick={() => onChange(null)}>
        <Ban aria-hidden="true" size={18} />
      </button>}
      {colors.map((color) => (
        <button key={color.value} type="button" disabled={disabled || color.disabled}
          title={color.label} aria-label={color.label} aria-pressed={value === color.value}
          style={{ backgroundColor: color.value, color: color.value }} onClick={() => onChange(color.value)} />
      ))}
    </div>
  );
}
