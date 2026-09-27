import type { ComponentPropsWithRef, ReactNode } from "react";

export interface NoticeProps extends ComponentPropsWithRef<"div"> {
  tone?: "neutral" | "success" | "danger";
  heading?: ReactNode;
  /** Decorative icon; the notice text should convey the same meaning. */
  icon?: ReactNode;
  actions?: ReactNode;
}

/** Static feedback by default. Set role="alert" or role="status" to announce updates. */
export function Notice({ tone = "neutral", heading, icon, actions, children, className, ...props }: NoticeProps) {
  return (
    <div {...props} className={["bnh-notice", `bnh-notice--${tone}`, className].filter(Boolean).join(" ")}>
      {icon != null && <span className="bnh-notice-icon" aria-hidden="true">{icon}</span>}
      <div className="bnh-notice-content">
        {heading != null && <div className="bnh-notice-heading">{heading}</div>}
        {children != null && <div className="bnh-notice-message">{children}</div>}
      </div>
      {actions != null && <div className="bnh-notice-actions">{actions}</div>}
    </div>
  );
}
