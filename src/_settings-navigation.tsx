import type { ReactNode } from "react";

export interface RailItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
  /** Optional ID of the content controlled by this item. */
  controls?: string;
}

export interface RailSection<Item extends RailItem = RailItem> {
  group: string;
  items: readonly Item[];
}

export function SettingsNavigationFrame({
  children,
  label = "Settings",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={["bnh-settings-rail", className].filter(Boolean).join(" ")}>
      <div className="bnh-settings-rail-inner">{children}</div>
    </nav>
  );
}

export function SettingsNavigationGroup({ group, children }: { group: string; children: ReactNode }) {
  return (
    <div className="bnh-settings-rail-section">
      <div className="bnh-settings-rail-group">{group}</div>
      {children}
    </div>
  );
}

export function SettingsNavigationItemContent({ item }: { item: RailItem }) {
  return (
    <>
      {item.icon != null && <span className="bnh-settings-rail-icon" aria-hidden="true">{item.icon}</span>}
      <span className="bnh-settings-rail-label">{item.label}</span>
      {item.badge != null && <span className="bnh-settings-rail-badge">{item.badge}</span>}
    </>
  );
}
