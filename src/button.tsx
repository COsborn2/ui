import type { ComponentPropsWithRef } from "react";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

/** Apply the same presentation to an anchor or an application router link. */
export function buttonClassName({ variant = "primary", size = "md", className }: Pick<ButtonProps, "variant" | "size" | "className"> = {}) {
  return ["bnh-button", `bnh-button--${variant}`, `bnh-button--${size}`, className].filter(Boolean).join(" ");
}

/** A native button. Set type="button" when it must not submit a form. */
export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
}
