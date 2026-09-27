import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

export interface SwitchProps extends Omit<ComponentPropsWithRef<"input">, "type" | "size"> {
  label?: ReactNode;
  description?: ReactNode;
  wrapperClassName?: string;
}

/** Native checkbox semantics and form submission, styled as a switch. */
export function Switch({
  label,
  description,
  wrapperClassName,
  className,
  id,
  "aria-describedby": describedBy,
  "aria-labelledby": labelledBy,
  ...props
}: SwitchProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const labelId = `${inputId}-label`;
  return (
    <label htmlFor={inputId} className={["bnh-switch", wrapperClassName].filter(Boolean).join(" ")}>
      <input
        {...props}
        type="checkbox"
        role="switch"
        id={inputId}
        aria-labelledby={labelledBy ?? (label && !props["aria-label"] ? labelId : undefined)}
        aria-describedby={[describedBy, description ? descriptionId : undefined].filter(Boolean).join(" ") || undefined}
        className={["bnh-switch-input", className].filter(Boolean).join(" ")}
      />
      <span aria-hidden="true" className="bnh-switch-track" />
      {(label || description) && (
        <span className="bnh-switch-copy">
          {label && <span id={labelId} className="bnh-switch-label">{label}</span>}
          {description && <span id={descriptionId} className="bnh-switch-description">{description}</span>}
        </span>
      )}
    </label>
  );
}
