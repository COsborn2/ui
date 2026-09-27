"use client";

import {
  SettingsNavigationFrame,
  SettingsNavigationGroup,
  SettingsNavigationItemContent,
  type RailSection,
} from "./_settings-navigation.js";

export type { RailItem, RailSection } from "./_settings-navigation.js";

export interface SettingsRailProps {
  sections: readonly RailSection[];
  active: string;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
}

/** Controlled navigation for sections switched by client state. */
export function SettingsRail({ sections, active, onChange, label, className }: SettingsRailProps) {
  return (
    <SettingsNavigationFrame label={label} className={className}>
      {sections.map((section) => (
        <SettingsNavigationGroup key={section.group} group={section.group}>
          {section.items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={active === item.id ? "true" : undefined}
              aria-controls={item.controls}
              onClick={() => onChange(item.id)}
              className={`bnh-settings-rail-item${active === item.id ? " is-active" : ""}`}
            >
              <SettingsNavigationItemContent item={item} />
            </button>
          ))}
        </SettingsNavigationGroup>
      ))}
    </SettingsNavigationFrame>
  );
}
