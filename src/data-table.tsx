import type { ComponentPropsWithRef, Key, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Skeleton } from "./skeleton.js";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Runs on the server when the table is rendered by a Server Component. */
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> extends Omit<ComponentPropsWithRef<"div">, "children"> {
  columns: readonly DataTableColumn<T>[];
  data: readonly T[];
  loading?: boolean;
  loadingRows?: number;
  emptyMessage?: ReactNode;
  /** Prefer a persistent ID when rows can be inserted, removed, or reordered. */
  getRowKey?: (row: T, index: number) => Key;
  caption?: ReactNode;
  tableClassName?: string;
  /** Requires a Client Component. Use links or buttons in cells for specific actions. */
  onRowClick?: (row: T) => void;
  /** Prefetch on pointer entry or focus within a row. Requires a Client Component. */
  onRowIntent?: (row: T) => void;
}

/** A native table with no client boundary, hooks, or event handlers for static rows. */
export function DataTable<T>({
  columns,
  data,
  loading = false,
  loadingRows = 5,
  emptyMessage = "No data found.",
  getRowKey,
  caption,
  tableClassName,
  onRowClick,
  onRowIntent,
  className,
  ...props
}: DataTableProps<T>) {
  return (
    <div {...props} className={["bnh-data-table", className].filter(Boolean).join(" ")}>
      <table className={["bnh-data-table__table", tableClassName].filter(Boolean).join(" ")} aria-busy={loading || undefined}>
        {caption != null && <caption className="bnh-data-table__caption">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} scope="col">{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: Math.max(0, loadingRows) }, (_, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key}><Skeleton className="bnh-data-table__skeleton" /></td>
                ))}
              </tr>
            ))
            : data.length === 0
              ? <tr><td colSpan={columns.length} className="bnh-data-table__empty">{emptyMessage}</td></tr>
              : data.map((row, index) => (
                <tr
                  key={getRowKey ? getRowKey(row, index) : index}
                  {...(onRowIntent ? {
                    onPointerEnter: () => onRowIntent(row),
                    onFocus: () => onRowIntent(row),
                  } : {})}
                  {...(onRowClick ? {
                    className: "bnh-data-table__row--interactive",
                    tabIndex: 0,
                    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
                      const target = event.target as Element;
                      if (target.closest("a, button, input, select, textarea, summary, [role='button'], [role='link'], [contenteditable]:not([contenteditable='false'])")) return;
                      onRowClick(row);
                    },
                    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    },
                  } : {})}
                >
                  {columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
