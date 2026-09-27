import type { ComponentPropsWithRef, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonClassName } from "./button.js";

/** Default rows per page; override with pageSize when needed. */
export const PAGE_SIZE = 20;

interface PaginationBaseProps extends Omit<ComponentPropsWithRef<"nav">, "children"> {
  /** Zero-based page index. */
  page: number;
  /** Total rows matching the current filters, across all pages. */
  total: number;
  /** Singular noun for the summary, e.g. "user". */
  itemLabel: string;
  pageSize?: number;
  /** Irregular plural when appending "s" is incorrect. */
  itemLabelPlural?: string;
  controlsClassName?: string;
}

export type PaginationProps = PaginationBaseProps & (
  | {
    /** Requires importing Pagination within a Client Component. */
    onPageChange: (page: number) => void;
    getPageHref?: never;
  }
  | {
    /** Creates ordinary links on the server; receives a zero-based page index. */
    getPageHref: (page: number) => string;
    onPageChange?: never;
  }
  | { onPageChange?: never; getPageHref?: never }
);

/** Server-compatible navigation links, or controlled buttons inside a client boundary. */
export function Pagination({
  page,
  total,
  itemLabel,
  onPageChange,
  getPageHref,
  pageSize = PAGE_SIZE,
  itemLabelPlural,
  className,
  controlsClassName,
  "aria-label": ariaLabel = "Pagination",
  ...props
}: PaginationProps) {
  const offset = page * pageSize;
  const showingStart = total === 0 ? 0 : offset + 1;
  const showingEnd = Math.min(offset + pageSize, total);
  const label = total === 1 ? itemLabel : (itemLabelPlural ?? `${itemLabel}s`);

  function control(targetPage: number, disabled: boolean, children: ReactNode, rel: "prev" | "next") {
    if (getPageHref && !disabled) {
      return <a className={buttonClassName({ variant: "secondary", size: "sm" })} href={getPageHref(targetPage)} rel={rel}>{children}</a>;
    }
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || !onPageChange}
        {...(onPageChange && !disabled ? { onClick: () => onPageChange(targetPage) } : {})}
      >
        {children}
      </Button>
    );
  }

  return (
    <nav {...props} aria-label={ariaLabel} className={["bnh-pagination", className].filter(Boolean).join(" ")}>
      <span className="bnh-pagination__summary">Showing {showingStart}-{showingEnd} of {total} {label}</span>
      <div className={["bnh-pagination__controls", controlsClassName].filter(Boolean).join(" ")}>
        {control(Math.max(0, page - 1), page <= 0, <><ChevronLeft aria-hidden="true" className="bnh-pagination__icon" />Previous</>, "prev")}
        {control(page + 1, offset + pageSize >= total, <>Next<ChevronRight aria-hidden="true" className="bnh-pagination__icon" /></>, "next")}
      </div>
    </nav>
  );
}
