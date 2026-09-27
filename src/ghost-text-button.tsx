import type { ComponentPropsWithRef } from "react";

export type GhostTextButtonProps = ComponentPropsWithRef<"button">;

export function GhostTextButton({ className, type = "button", ...props }: GhostTextButtonProps) {
  return <button type={type} className={["bnh-ghost-text-button", className].filter(Boolean).join(" ")} {...props} />;
}
