import { useId, type ComponentPropsWithRef } from "react";

export interface SelectProps extends Omit<ComponentPropsWithRef<"select">, "size"> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  size?: "md" | "sm";
}

export function Select({
  className,
  wrapperClassName,
  label,
  error,
  id,
  size = "md",
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  return (
    <div className={["bnh-select-field", wrapperClassName].filter(Boolean).join(" ")}>
      {label && <label htmlFor={selectId} className="bnh-select-label">{label}</label>}
      <select
        {...props}
        id={selectId}
        aria-invalid={invalid ?? (error ? true : undefined)}
        aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined}
        className={["bnh-select", `bnh-select--${size}`, error && "bnh-select--error", className]
          .filter(Boolean).join(" ")}
      />
      {error && <p id={errorId} className="bnh-select-error">{error}</p>}
    </div>
  );
}
