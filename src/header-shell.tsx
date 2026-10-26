import { createElement, type ComponentPropsWithRef, type CSSProperties, type ReactElement, type ReactNode } from "react";

export const HEADER_PAD_Y = 6;
export const HEADER_PAD_X = 16;

interface HeaderShellLayoutProps {
  left: ReactNode;
  right?: ReactNode;
  width?: "content" | "full";
  /** Content width only. */
  minWidth?: number | string;
  /** Defaults to `calc(100vw - 28px)`. */
  maxWidth?: number | string;
  /** Full width only; pixels on each side. Defaults to 24. */
  sideMargin?: number;
  /** Defaults to `var(--bnh-header-top, 18px)`. */
  top?: number | string;
  /** Defaults to 30. */
  zIndex?: number;
  /** Pixels between the left and right slots. Defaults to 10. */
  gap?: number;
}

export type HeaderShellProps = HeaderShellLayoutProps & (
  | ({ as?: "div" } & Omit<ComponentPropsWithRef<"div">, "children">)
  | ({ as: "header" } & Omit<ComponentPropsWithRef<"header">, "children">)
);

export function HeaderShell({
  as: Element = "div",
  left,
  right,
  className,
  width = "content",
  minWidth,
  maxWidth,
  sideMargin,
  top,
  zIndex,
  gap,
  style,
  ...props
}: HeaderShellProps): ReactElement {
  // Layout props become custom properties; header-shell.css owns the
  // declarations so application stylesheets can restyle the shell.
  return createElement(Element, {
    ...props,
    className: ["bnh-header-shell", width === "full" && "bnh-header-shell--full", className].filter(Boolean).join(" "),
    style: {
      "--bnh-header-shell-top": length(top),
      "--bnh-header-shell-z": zIndex,
      "--bnh-header-shell-gap": length(gap),
      "--bnh-header-shell-min-width": length(minWidth),
      "--bnh-header-shell-max-width": length(maxWidth),
      "--bnh-header-shell-side-margin": length(sideMargin),
      ...style,
    } as CSSProperties,
  }, left, right);
}

function length(value: number | string | undefined) {
  return typeof value === "number" ? `${value}px` : value;
}
