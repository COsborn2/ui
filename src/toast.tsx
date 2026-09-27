import type { ComponentPropsWithRef, ReactNode } from "react";
import { Check, CircleAlert, Sparkles, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export interface ToastProps extends Omit<ComponentPropsWithRef<"div">, "children" | "role" | "aria-live" | "aria-atomic"> {
  message: ReactNode;
  variant?: ToastVariant;
  action?: ToastAction;
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Fraction of time remaining, from 0 to 1. Omit for persistent notifications. */
  progress?: number;
  /** Errors are assertive by default; other messages are polite. */
  announce?: "polite" | "assertive" | "off";
}

const icons = { success: Check, error: CircleAlert, info: Sparkles };

/**
 * Controlled presentation: the host owns notification state, timers, and actions.
 * Import inside a Client Component when supplying event handlers. Only the
 * message is a live region, so progress updates and controls are not announced.
 */
export function Toast({
  message,
  variant = "info",
  action,
  onDismiss,
  dismissLabel = "Dismiss notification",
  progress,
  announce = variant === "error" ? "assertive" : "polite",
  className,
  ...props
}: ToastProps) {
  const Icon = icons[variant];
  const remaining = progress == null || !Number.isFinite(progress) ? undefined : Math.max(0, Math.min(1, progress));
  return (
    <div {...props} className={["bnh-toast", `bnh-toast--${variant}`, className].filter(Boolean).join(" ")}>
      <span className="bnh-toast__indicator" aria-hidden="true">
        <svg className="bnh-toast__ring" width="28" height="28" viewBox="0 0 28 28" focusable="false">
          <circle className="bnh-toast__ring-track" cx="14" cy="14" r="11" />
          {remaining !== undefined && (
            <circle className="bnh-toast__ring-progress" cx="14" cy="14" r="11" pathLength="1"
              strokeDasharray="1" strokeDashoffset={1 - remaining} transform="rotate(-90 14 14)" />
          )}
        </svg>
        <Icon size={13} aria-hidden="true" className="bnh-toast__icon" />
      </span>
      <div className="bnh-toast__message"
        role={announce === "off" ? undefined : announce === "assertive" ? "alert" : "status"}
        aria-live={announce} aria-atomic="true">
        {message}
      </div>
      {action && (
        <button type="button" className="bnh-toast__action" aria-label={action.ariaLabel}
          disabled={action.disabled} onClick={action.onClick}>{action.label}</button>
      )}
      {onDismiss && (
        <button type="button" className="bnh-toast__dismiss" onClick={onDismiss} aria-label={dismissLabel} title={dismissLabel}>
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export interface ToastViewportProps extends ComponentPropsWithRef<"div"> {
  /**
   * Keep this object present from the first render so live regions exist before
   * notifications arrive. Supply keyed message-only children and use announce="off"
   * on the visual toasts. Timers, actions, and removal controls stay outside them.
   */
  announcements?: { polite?: ReactNode; assertive?: ReactNode };
}

/** A presentation-only stack; style or CSS variables can customize its position. */
export function ToastViewport({ announcements, className, "aria-label": label = "Notifications", ...props }: ToastViewportProps) {
  return <>
    {announcements && <>
      <div className="bnh-toast-announcer" role="status" aria-live="polite" aria-atomic="false" aria-relevant="additions text">{announcements.polite}</div>
      <div className="bnh-toast-announcer" role="alert" aria-live="assertive" aria-atomic="false" aria-relevant="additions text">{announcements.assertive}</div>
    </>}
    <div role="region" aria-label={label} {...props} className={["bnh-toast-viewport", className].filter(Boolean).join(" ")} />
  </>;
}
