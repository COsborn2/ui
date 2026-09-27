import type { ComponentPropsWithRef } from "react";

export interface IconButtonProps extends ComponentPropsWithRef<"button"> {
  tone?: "neutral" | "danger";
  /** Reveal on parent .group or [data-bnh-group] hover/focus; visible on touch. */
  revealOnHover?: boolean;
}

export function IconButton({ className, tone = "neutral", revealOnHover = false, type = "button", ...props }: IconButtonProps) {
  return <button type={type} className={["bnh-icon-button", `bnh-icon-button--${tone}`, revealOnHover && "bnh-icon-button--reveal", className].filter(Boolean).join(" ")} {...props} />;
}
