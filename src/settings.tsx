import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  SettingsNavigationFrame,
  SettingsNavigationGroup,
  SettingsNavigationItemContent,
  type RailItem,
  type RailSection,
} from "./_settings-navigation.js";

export type { RailItem, RailSection } from "./_settings-navigation.js";

export interface SettingsLayoutProps extends HTMLAttributes<HTMLDivElement> {
  backdrop?: ReactNode;
  header?: ReactNode;
  navigation?: ReactNode;
  bodyClassName?: string;
  contentClassName?: string;
}

/** Static settings frame. Slots may contain server or interactive components. */
export function SettingsLayout({
  backdrop, header, navigation, children, className, bodyClassName, contentClassName, ...props
}: SettingsLayoutProps) {
  return (
    <div className={["bnh-settings-page", className].filter(Boolean).join(" ")} {...props}>
      {backdrop}
      <div className="bnh-settings-shell">
        {header}
        <div className={["bnh-settings-body", bodyClassName].filter(Boolean).join(" ")}>
          {navigation}
          <main className="bnh-settings-main">
            <div className={["bnh-settings-content", contentClassName].filter(Boolean).join(" ")}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export interface SettingsPageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  animate?: boolean;
}

export function SettingsPageHeader({ title, eyebrow, description, animate = false, className, ...props }: SettingsPageHeaderProps) {
  return (
    <header className={["bnh-settings-page-header", animate && "bnh-settings-enter", className].filter(Boolean).join(" ")} {...props}>
      {eyebrow != null && <div className="bnh-settings-eyebrow">{eyebrow}</div>}
      <h1 className="bnh-settings-title">{title}</h1>
      {description != null && <p className="bnh-settings-description">{description}</p>}
    </header>
  );
}

export interface SettingsCardProps extends HTMLAttributes<HTMLElement> {
  danger?: boolean;
}

export function SettingsCard({ children, danger = false, className, ...props }: SettingsCardProps) {
  return <section className={["bnh-settings-card", danger && "bnh-settings-card--danger", className].filter(Boolean).join(" ")} {...props}>{children}</section>;
}

export interface SettingsCardHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  danger?: boolean;
  action?: ReactNode;
}

export function SettingsCardHeader({ title, subtitle, danger = false, action, className, ...props }: SettingsCardHeaderProps) {
  return (
    <header className={["bnh-settings-card-header", subtitle != null && "bnh-settings-card-header--description", danger && "bnh-settings-card-header--danger", className].filter(Boolean).join(" ")} {...props}>
      <div className="bnh-settings-card-heading">
        <h3 className="bnh-settings-card-title">{title}</h3>
        {subtitle != null && <p className="bnh-settings-card-subtitle">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export interface SettingsRowProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  hint?: ReactNode;
  vertical?: boolean;
  first?: boolean;
}

export function SettingsRow({ label, hint, children, vertical = false, first = false, className, ...props }: SettingsRowProps) {
  return (
    <div className={["bnh-settings-row", vertical && "is-vertical", first && "is-first", className].filter(Boolean).join(" ")} {...props}>
      <div className="bnh-settings-row-label">
        <div className="bnh-settings-row-title">{label}</div>
        {hint != null && <div className="bnh-settings-row-hint">{hint}</div>}
      </div>
      <div className="bnh-settings-row-control">{children}</div>
    </div>
  );
}

export interface SettingsSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  accent?: "purple" | "rose";
  headerAction?: ReactNode;
  index?: number;
}

export function SettingsSection({ title, subtitle, accent, headerAction, index = 0, children, className, style, ...props }: SettingsSectionProps) {
  return (
    <section
      className={["bnh-settings-section", "bnh-settings-enter", accent && `bnh-settings-section--${accent}`, className].filter(Boolean).join(" ")}
      style={{ ...(index > 0 ? { animationDelay: `${index * 80}ms` } : {}), ...style } as CSSProperties}
      {...props}
    >
      <div className={`bnh-settings-section-header${subtitle != null ? " bnh-settings-section-header--description" : ""}`}>
        <h2 className="bnh-settings-section-title">{title}</h2>
        {headerAction}
      </div>
      {subtitle != null && <p className="bnh-settings-section-subtitle">{subtitle}</p>}
      {children}
    </section>
  );
}

export interface SettingsNavigationItem extends RailItem {
  href: string;
}

export interface SettingsNavigationProps {
  sections: readonly RailSection<SettingsNavigationItem>[];
  active?: string;
  label?: string;
  className?: string;
}

/** Link navigation works without client JavaScript or a router dependency. */
export function SettingsNavigation({ sections, active, label, className }: SettingsNavigationProps) {
  return (
    <SettingsNavigationFrame label={label} className={className}>
      {sections.map((section) => (
        <SettingsNavigationGroup key={section.group} group={section.group}>
          {section.items.map((item) => (
            <a
              key={item.id}
              href={item.href}
              aria-current={active === item.id ? "page" : undefined}
              className={`bnh-settings-rail-item${active === item.id ? " is-active" : ""}`}
            >
              <SettingsNavigationItemContent item={item} />
            </a>
          ))}
        </SettingsNavigationGroup>
      ))}
    </SettingsNavigationFrame>
  );
}
