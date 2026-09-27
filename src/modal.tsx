"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { useEscapeLayer } from "./_escape-layer.js";
import { usePortalTheme } from "./_portal-theme.js";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  ariaLabel?: string;
  trigger?: ReactElement;
  headerActions?: ReactNode;
  footer?: ReactNode;
  persistent?: boolean;
  width?: CSSProperties["maxWidth"];
  zIndex?: number;
  className?: string;
  bodyClassName?: string;
  /** Explicit theme override. Otherwise inherits tokens from the rendering location. */
  theme?: "light" | "dark";
  portalContainer?: HTMLElement | null;
}

/**
 * Accessible client dialog. The trigger renders during SSR; portal content mounts
 * after hydration. Server-rendered children can be passed through this boundary.
 * Import modal.css and theme.css in the consuming application's CSS entry.
 */
export function Modal({
  open, onOpenChange, children, title, subtitle, ariaLabel, trigger, headerActions,
  footer, persistent = false, width = 640, zIndex = 100, className, bodyClassName,
  theme, portalContainer,
}: ModalProps) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const descriptionId = useId();
  const dismiss = useCallback(() => { if (!persistent) onOpenChange(false); }, [onOpenChange, persistent]);
  const { origin, setOrigin, onEscapeKeyDown, isTopLayer } = useEscapeLayer(open, dismiss, portalContainer);
  const inheritedTokens = usePortalTheme(origin, open, theme, portalContainer);

  useLayoutEffect(() => {
    if (!open) return;
    const active = origin.current?.ownerDocument.activeElement;
    returnFocus.current = active && "focus" in active ? active as HTMLElement : null;
  }, [open]);

  const style = {
    ...inheritedTokens,
    "--bnh-modal-width": typeof width === "number" ? `${width}px` : width,
    "--bnh-modal-z": zIndex,
  } as CSSProperties;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (next || !persistent) onOpenChange(next); }}>
      {/* Register before portal children run layout effects, even when an
          explicit container allows them to mount in this same commit. */}
      <span ref={setOrigin} hidden data-bnh-theme={theme} />
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal container={portalContainer ?? undefined}>
        <Dialog.Overlay className="bnh-modal-backdrop" style={style} />
        <Dialog.Content
          ref={content}
          className={["bnh-modal", className].filter(Boolean).join(" ")}
          style={style}
          aria-modal="true"
          aria-describedby={subtitle ? descriptionId : undefined}
          onEscapeKeyDown={onEscapeKeyDown}
          onKeyDown={(event) => {
            // First-commit fallback before Radix has installed any listener.
            // Settled Radix widgets already preventDefault when consuming Escape.
            if (event.key === "Escape") onEscapeKeyDown(event);
          }}
          onInteractOutside={(event) => {
            if (persistent || !isTopLayer(event.detail.originalEvent)) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            const active = (event.target as HTMLElement).ownerDocument.activeElement;
            if (!returnFocus.current && active && "focus" in active) returnFocus.current = active as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            const active = returnFocus.current?.ownerDocument.activeElement;
            const orphaned = !active || active === active.ownerDocument.body || !!content.current?.contains(active);
            // A closing dialog must not steal focus from a newly opened dialog
            // or another destination the consumer deliberately focused.
            event.preventDefault();
            if (orphaned && returnFocus.current?.isConnected) {
              returnFocus.current.focus();
            }
          }}
        >
          {!persistent && <Dialog.Close className="bnh-modal-close" type="button" aria-label="Close"><X size={16} aria-hidden="true" /></Dialog.Close>}
          {headerActions && <div className="bnh-modal-actions">{headerActions}</div>}
          {title ? (
            <div className="bnh-modal-heading">
              <Dialog.Title className="bnh-modal-title">{title}</Dialog.Title>
              {subtitle && <Dialog.Description id={descriptionId} className="bnh-modal-subtitle">{subtitle}</Dialog.Description>}
            </div>
          ) : <Dialog.Title className="bnh-modal-visually-hidden">{ariaLabel ?? "Dialog"}</Dialog.Title>}
          {!title && subtitle && <Dialog.Description id={descriptionId} className="bnh-modal-subtitle">{subtitle}</Dialog.Description>}
          <div className={["bnh-modal-body", bodyClassName].filter(Boolean).join(" ")}>{children}</div>
          {footer && <div className="bnh-modal-footer">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
