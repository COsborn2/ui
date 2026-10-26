import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable, type DataTableColumn } from "../src/data-table.js";
import { Pagination } from "../src/pagination.js";

type Row = { id: string; name: string };
const rows: Row[] = [{ id: "alex", name: "Alex" }, { id: "sam", name: "Sam" }];
const columns: DataTableColumn<Row>[] = [{ key: "name", header: "Name", render: (row) => <a href={`/people/${row.id}`}>{row.name}</a> }];

describe("DataTable", () => {
  test("provides a named table with column headers and ordinary cell links", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} caption="People" />);
    const table = screen.getByRole("table", { name: "People" });
    expect(within(table).getByRole("columnheader", { name: "Name" })).toHaveAttribute("scope", "col");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByRole("link", { name: "Alex" })).toHaveAttribute("href", "/people/alex");
    await user.tab();
    expect(screen.getByRole("link", { name: "Alex" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Sam" })).toHaveFocus();
  });

  test("loading announces a busy table and yields to results when complete", () => {
    const { rerender } = render(<DataTable columns={columns} data={rows} caption="People" loading loadingRows={3} />);
    expect(screen.getByRole("table", { name: "People" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.queryByRole("link", { name: "Alex" })).not.toBeInTheDocument();
    rerender(<DataTable columns={columns} data={rows} caption="People" />);
    expect(screen.getByRole("table")).not.toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("link", { name: "Alex" })).toBeInTheDocument();
  });

  test("an empty message spans the columns and supports a recovery action", async () => {
    const user = userEvent.setup();
    const clear = vi.fn();
    render(<DataTable columns={[...columns, { key: "id", header: "ID", render: (row) => row.id }]} data={[]}
      emptyMessage={<><p>No matching people.</p><button onClick={clear}>Clear filters</button></>} />);
    expect(screen.getByRole("cell")).toHaveAttribute("colspan", "2");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(clear).toHaveBeenCalledOnce();
  });

  test("stable row keys preserve entered values when records reorder", async () => {
    const user = userEvent.setup();
    const editable: DataTableColumn<Row>[] = [{ key: "name", header: "Name", render: (row) => <input aria-label={`${row.id} name`} defaultValue={row.name} /> }];
    const { rerender } = render(<DataTable columns={editable} data={rows} getRowKey={(row) => row.id} />);
    await user.clear(screen.getByRole("textbox", { name: "alex name" }));
    await user.type(screen.getByRole("textbox", { name: "alex name" }), "Alexandra");
    rerender(<DataTable columns={editable} data={[...rows].reverse()} getRowKey={(row) => row.id} />);
    expect(screen.getByRole("textbox", { name: "alex name" })).toHaveValue("Alexandra");
    expect(screen.getByRole("textbox", { name: "sam name" })).toHaveValue("Sam");
  });

  test("click, Enter, and Space activate the matching row", async () => {
    const user = userEvent.setup();
    const selected = vi.fn();
    render(<DataTable columns={[{ key: "name", header: "Name", render: (row: Row) => row.name }]} data={rows} onRowClick={selected} />);
    const alex = screen.getByRole("row", { name: "Alex" });
    await user.click(within(alex).getByRole("cell"));
    alex.focus();
    await user.keyboard("{Enter} ");
    expect(selected.mock.calls).toEqual([[rows[0]], [rows[0]], [rows[0]]]);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(selected).toHaveBeenLastCalledWith(rows[1]);
  });

  test("nested cell controls keep their own pointer and keyboard actions", async () => {
    const user = userEvent.setup();
    const selected = vi.fn();
    const action = vi.fn();
    render(<DataTable columns={[{ key: "name", header: "Name", render: (row: Row) => <><button onClick={() => action(row.id)}>Edit {row.name}</button><input aria-label={`${row.name} note`} /></> }]} data={rows} onRowClick={selected} />);
    await user.click(screen.getByRole("button", { name: "Edit Alex" }));
    await user.keyboard("{Enter} ");
    await user.type(screen.getByRole("textbox", { name: "Alex note" }), "A note{Enter}");
    expect(action).toHaveBeenCalledTimes(3);
    expect(selected).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Alex note" })).toHaveValue("A note");
  });

  test("row intent identifies hovered and focused records without adding row tab stops", async () => {
    const user = userEvent.setup();
    const intent = vi.fn();
    render(<DataTable columns={columns} data={rows} onRowIntent={intent} />);
    await user.hover(screen.getByRole("row", { name: "Sam" }));
    expect(intent).toHaveBeenLastCalledWith(rows[1]);
    await user.tab();
    expect(screen.getByRole("link", { name: "Alex" })).toHaveFocus();
    expect(intent).toHaveBeenLastCalledWith(rows[0]);
  });
});

describe("Pagination", () => {
  test("controlled paging updates the summary and enforces both boundaries without submitting", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn((event) => event.preventDefault());
    function Pages() {
      const [page, setPage] = useState(0);
      return <form onSubmit={submitted}><Pagination page={page} total={13} pageSize={5} itemLabel="entry" itemLabelPlural="entries" onPageChange={setPage} /></form>;
    }
    render(<Pages />);
    expect(screen.getByText("Showing 1-5 of 13 entries")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 6-10 of 13 entries")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 11-13 of 13 entries")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Showing 6-10 of 13 entries")).toBeInTheDocument();
    expect(submitted).not.toHaveBeenCalled();
  });

  test("link pagination exposes real destinations and never requests out-of-range pages", () => {
    const href = vi.fn((page: number) => `/people?page=${page}`);
    const { rerender } = render(<Pagination page={1} total={63} itemLabel="user" getPageHref={href} />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/people?page=0");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("rel", "next");
    expect(screen.getByText("Showing 21-40 of 63 users")).toBeInTheDocument();
    href.mockClear();
    rerender(<Pagination page={0} total={25} itemLabel="user" getPageHref={href} />);
    expect(href).toHaveBeenCalledExactlyOnceWith(1);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    href.mockClear();
    rerender(<Pagination page={1} total={25} itemLabel="user" getPageHref={href} />);
    expect(href).toHaveBeenCalledExactlyOnceWith(0);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  test("empty and single-item summaries remain useful with no enabled controls", () => {
    const href = vi.fn();
    const { rerender } = render(<Pagination page={0} total={0} itemLabel="entry" itemLabelPlural="entries" getPageHref={href} />);
    expect(screen.getByText("Showing 0-0 of 0 entries")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(href).not.toHaveBeenCalled();
    rerender(<Pagination page={0} total={1} itemLabel="entry" />);
    expect(screen.getByText("Showing 1-1 of 1 entry")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});
