import { useId, type ComponentPropsWithRef } from "react";

export interface InputProps extends ComponentPropsWithRef<"input"> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export function Input({
  className,
  wrapperClassName,
  label,
  error,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className={["bnh-input-field", wrapperClassName].filter(Boolean).join(" ")}>
      {label && <label htmlFor={inputId} className="bnh-input-label">{label}</label>}
      <input
        {...props}
        id={inputId}
        aria-invalid={invalid ?? (error ? true : undefined)}
        aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined}
        className={["bnh-input", error && "bnh-input--error", className].filter(Boolean).join(" ")}
      />
      {error && <p id={errorId} className="bnh-input-error">{error}</p>}
    </div>
  );
}
