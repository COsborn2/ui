import { describe, expect, test } from "bun:test";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../src/button.js";
import { DataTable, type DataTableColumn } from "../src/data-table.js";
import { Pagination, PAGE_SIZE } from "../src/pagination.js";

type Row = { id: string; name: string };
const rows: Row[] = [{ id: "alex", name: "Alex" }, { id: "sam", name: "Sam" }];
const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", render: (row) => <a href={`/people/${row.id}`}>{row.name}</a> },
];

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const result: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (isValidElement<Record<string, unknown>>(child)) {
      result.push(child, ...elements(child.props.children as ReactNode));
    }
  });
  return result;
}

describe("DataTable", () => {
  test("renders semantic headers, caption, and cell links in server HTML", () => {
    const html = renderToStaticMarkup(<DataTable columns={columns} data={rows} caption="People" />);
    expect(html).toContain('<caption class="bnh-data-table__caption">People</caption>');
    expect(html).toContain('<th scope="col">Name</th>');
    expect(html).toContain('<a href="/people/alex">Alex</a>');
    expect(html).not.toContain('tabindex=');
  });

  test("static rows have no event handler props or artificial focus targets", () => {
    const tree = DataTable({ columns, data: rows });
    for (const element of elements(tree)) {
      expect(Object.keys(element.props).filter((name) => /^on[A-Z]/.test(name))).toEqual([]);
      expect(element.props.tabIndex).toBeUndefined();
    }
  });

  test("loading rows replace data and announce the busy table", () => {
    const html = renderToStaticMarkup(<DataTable columns={columns} data={rows} loading loadingRows={3} />);
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/class="bnh-skeleton /g)).toHaveLength(3);
    expect(html).not.toContain("Alex");
    expect(html).not.toContain("No data found.");
  });

  test("empty content spans every column and accepts rich content", () => {
    const html = renderToStaticMarkup(<DataTable columns={[...columns, { key: "id", header: "ID", render: (row) => row.id }]} data={[]} emptyMessage={<span>No matching people.</span>} />);
    expect(html).toContain('colSpan="2"');
    expect(html).toContain("<span>No matching people.</span>");
    expect(html).not.toContain("aria-busy");
  });

  test("row identities survive a reorder when getRowKey is provided", () => {
    const rowKeys = (data: Row[]) => elements(DataTable({ columns, data, getRowKey: (row) => row.id }))
      .filter((element) => element.type === "tr" && element.key !== null)
      .map((element) => element.key);
    expect(rowKeys(rows)).toEqual(["alex", "sam"]);
    expect(rowKeys([...rows].reverse())).toEqual(["sam", "alex"]);
  });

  test("interactive rows activate their own record with pointer or keyboard input", () => {
    const selected: string[] = [];
    const row = elements(DataTable({ columns, data: rows, onRowClick: (value) => selected.push(value.id) }))
      .find((element) => element.type === "tr" && element.props.onClick)!;
    expect(row.props.tabIndex).toBe(0);
    (row.props.onClick as (event: unknown) => void)({ target: { closest: () => null } });
    const target = {};
    let prevented = false;
    (row.props.onKeyDown as (event: unknown) => void)({ key: "Enter", target, currentTarget: target, preventDefault: () => { prevented = true; } });
    expect(selected).toEqual(["alex", "alex"]);
    expect(prevented).toBe(true);
    (row.props.onKeyDown as (event: unknown) => void)({ key: " ", target, currentTarget: target, preventDefault: () => {} });
    expect(selected).toEqual(["alex", "alex", "alex"]);
    (row.props.onKeyDown as (event: unknown) => void)({ key: "Enter", target: {}, currentTarget: target, preventDefault: () => {} });
    (row.props.onClick as (event: unknown) => void)({ target: { closest: () => ({}) } });
    expect(selected).toHaveLength(3);
  });

  test("row intent prefetches the matching record without making static rows clickable", () => {
    const requested: string[] = [];
    const tree = DataTable({ columns, data: rows, onRowIntent: (row) => requested.push(row.id) });
    const rowElements = elements(tree).filter((element) => element.type === "tr" && element.props.onPointerEnter);
    (rowElements[0].props.onPointerEnter as () => void)();
    (rowElements[1].props.onFocus as () => void)();
    expect(requested).toEqual(["alex", "sam"]);
    expect(tree.props.onRowIntent).toBeUndefined();
    for (const row of rowElements) {
      expect(row.props.onClick).toBeUndefined();
      expect(row.props.tabIndex).toBeUndefined();
    }
  });
});

describe("Pagination", () => {
  test("retains the default page size and custom summary labels", () => {
    expect(PAGE_SIZE).toBe(20);
    expect(renderToStaticMarkup(<Pagination page={2} total={63} itemLabel="user" />)).toContain("Showing 41-60 of 63 users");
    expect(renderToStaticMarkup(<Pagination page={0} total={1} itemLabel="entry" />)).toContain("Showing 1-1 of 1 entry");
    expect(renderToStaticMarkup(<Pagination page={1} total={13} pageSize={5} itemLabel="entry" itemLabelPlural="entries" />)).toContain("Showing 6-10 of 13 entries");
  });

  test("renders real previous and next links without event handlers", () => {
    const requested: number[] = [];
    const tree = Pagination({ page: 1, total: 63, itemLabel: "user", getPageHref: (page) => {
      requested.push(page);
      return `/people?page=${page}`;
    } });
    const html = renderToStaticMarkup(tree);
    expect(requested).toEqual([0, 2]);
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain('href="/people?page=0" rel="prev"');
    expect(html).toContain('href="/people?page=2" rel="next"');
    expect(html).not.toContain("<button");
    for (const element of elements(tree)) {
      expect(Object.keys(element.props).filter((name) => /^on[A-Z]/.test(name))).toEqual([]);
    }
  });

  test("does not generate out-of-range links at either boundary", () => {
    const requested: number[] = [];
    const getPageHref = (page: number) => { requested.push(page); return `?page=${page}`; };
    const first = renderToStaticMarkup(<Pagination page={0} total={25} itemLabel="user" getPageHref={getPageHref} />);
    const last = renderToStaticMarkup(<Pagination page={1} total={25} itemLabel="user" getPageHref={getPageHref} />);
    expect(requested).toEqual([1, 0]);
    expect(first.match(/disabled=""/g)).toHaveLength(1);
    expect(last.match(/disabled=""/g)).toHaveLength(1);
    expect(last).toContain("Showing 21-25 of 25 users");
  });

  test("handles empty data without a live link or invalid summary", () => {
    const html = renderToStaticMarkup(<Pagination page={0} total={0} itemLabel="user" getPageHref={() => { throw new Error("No links should be generated"); }} />);
    expect(html).toContain("Showing 0-0 of 0 users");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).not.toContain("href=");
  });

  test("controlled buttons call the selected page and never submit a parent form", () => {
    const selected: number[] = [];
    const tree = Pagination({ page: 1, total: 63, itemLabel: "user", onPageChange: (page) => selected.push(page) });
    const buttons = elements(tree).filter((element) => element.type === Button);
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.props.type).toBe("button");
      (button.props.onClick as () => void)();
    }
    expect(selected).toEqual([0, 2]);
  });

  test("static controls are disabled and contain no click handlers", () => {
    const buttons = elements(Pagination({ page: 1, total: 63, itemLabel: "user" })).filter((element) => element.type === Button);
    for (const button of buttons) {
      expect(button.props.disabled).toBe(true);
      expect(button.props.onClick).toBeUndefined();
    }
  });
});
