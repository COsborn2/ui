"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ellipsis } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { useEscapeLayer } from "./_escape-layer.js";
import { usePortalTheme } from "./_portal-theme.js";

export interface ActionItem {
  id?: string;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  icon?: ReactNode;
}

export interface ActionsMenuProps {
  items: readonly ActionItem[];
  ariaLabel?: string;
  /** A button that forwards its native props/ref, for example the shared Button. */
  trigger?: ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  collisionPadding?: number;
  portalContainer?: HTMLElement | null;
  theme?: "light" | "dark";
  zIndex?: number;
  className?: string;
  triggerClassName?: string;
}

/** Accessible action menu with deferred portals, keyboard navigation and collision handling. */
export function ActionsMenu({
  items, ariaLabel, trigger, open, defaultOpen = false, onOpenChange, disabled = false,
  align = "end", sideOffset = 4, collisionPadding = 8, portalContainer, theme,
  zIndex, className, triggerClassName,
}: ActionsMenuProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handledOutside = useRef<PointerEvent | null>(null);
  const unavailable = disabled || !items.length;
  const isOpen = !unavailable && (open ?? internalOpen);
  const changeOpen = useCallback((value: boolean) => {
    if (open === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  }, [onOpenChange, open]);
  const dismiss = useCallback(() => changeOpen(false), [changeOpen]);
  const { origin, setOrigin, onEscapeKeyDown, isTopLayer } = useEscapeLayer(isOpen, dismiss, portalContainer);
  const tokens = usePortalTheme(origin, isOpen, theme, portalContainer);
  const style = { ...tokens, ...(zIndex === undefined ? {} : { "--bnh-actions-menu-z": zIndex }) } as CSSProperties;

  useLayoutEffect(() => {
    const document = portalContainer?.ownerDocument ?? origin.current?.ownerDocument;
    if (!isOpen || !document) return;
    const pointerDown = (event: PointerEvent) => {
      const content = contentRef.current;
      const target = event.target as Node | null;
      if (!target || !content || content.contains(target) || triggerRef.current?.contains(target)
        || content.style.pointerEvents === "none" || !isTopLayer(event)) return;
      // Radix defers attaching its outside-pointer listener until a later task.
      // Defer past the whole event dispatch (microtasks can run between native
      // listeners), then cover only an event its normal handler did not handle.
      setTimeout(() => {
        if (!event.defaultPrevented && handledOutside.current !== event
          && contentRef.current && isTopLayer() && isTopLayer(event)) changeOpen(false);
      }, 0);
    };
    document.addEventListener("pointerdown", pointerDown);
    return () => document.removeEventListener("pointerdown", pointerDown);
  }, [changeOpen, isOpen, isTopLayer, origin, portalContainer]);

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={changeOpen}>
      <span ref={setOrigin} hidden data-bnh-theme={theme} />
      <DropdownMenu.Trigger
        ref={triggerRef}
        asChild={Boolean(trigger)}
        type="button"
        disabled={unavailable}
        aria-label={ariaLabel ?? (trigger ? undefined : "More actions")}
        className={[!trigger && "bnh-actions-menu-trigger", triggerClassName].filter(Boolean).join(" ") || undefined}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) event.stopPropagation();
        }}
      >
        {trigger ?? <Ellipsis size={16} aria-hidden="true" />}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalContainer ?? undefined}>
        <DropdownMenu.Content
          ref={contentRef}
          className={["bnh-actions-menu", className].filter(Boolean).join(" ")}
          style={style}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          loop
          onEscapeKeyDown={onEscapeKeyDown}
          onPointerDownOutside={(event) => { handledOutside.current = event.detail.originalEvent; }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onEscapeKeyDown(event);
            event.stopPropagation();
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item, index) => (
            <DropdownMenu.Item
              key={item.id ?? `${item.label}-${index}`}
              className={["bnh-actions-menu-item", item.variant === "danger" && "bnh-actions-menu-item--danger"].filter(Boolean).join(" ")}
              disabled={item.disabled}
              textValue={item.label}
              onSelect={() => item.onClick()}
            >
              {item.icon && <span className="bnh-actions-menu-icon" aria-hidden="true">{item.icon}</span>}
              <span>{item.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
