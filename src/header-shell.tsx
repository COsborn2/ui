import { createElement, type ComponentPropsWithRef, type CSSProperties, type ReactElement, type ReactNode } from "react";

export const HEADER_PAD_Y = 6;
export const HEADER_PAD_X = 16;

interface HeaderShellLayoutProps {
  left: ReactNode;
  right?: ReactNode;
  width?: "content" | "full";
  minWidth?: CSSProperties["minWidth"];
  maxWidth?: number | string;
  sideMargin?: number;
  top?: number | string;
  zIndex?: number;
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
  maxWidth = "calc(100vw - 28px)",
  sideMargin = 24,
  top = "var(--bnh-header-top, 18px)",
  zIndex = 30,
  gap = 10,
  style,
  ...props
}: HeaderShellProps): ReactElement {
  const maxW = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;
  return createElement(Element, {
    ...props,
    className: ["bnh-header-shell", className].filter(Boolean).join(" "),
    style: {
      position: "fixed",
      top,
      marginTop: "var(--bnh-header-offset, 0px)",
      zIndex,
      gap,
      padding: `${HEADER_PAD_Y}px ${HEADER_PAD_X}px`,
      ...(width === "full"
        ? { width: `min(calc(100vw - ${sideMargin * 2}px), ${maxW})` }
        : { width: "max-content", minWidth, maxWidth }),
      ...style,
    },
  }, left, right);
}
