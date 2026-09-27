"use client";

import { useState } from "react";
import { ThemeToggle, type ThemePreference } from "@cosborn2/ui/theme-toggle";
import { ColorPicker } from "@cosborn2/ui/color-picker";
import { DataTable } from "@cosborn2/ui/data-table";
import { Pagination } from "@cosborn2/ui/pagination";

export function ControlExamples() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [color, setColor] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState("");
  const [intent, setIntent] = useState("");
  const [submissions, setSubmissions] = useState(0);
  return (
    <section data-testid="control-examples">
      <h2>Shared preferences and data</h2>
      <form onSubmit={(event) => { event.preventDefault(); setSubmissions((count) => count + 1); }}>
        <ThemeToggle value={theme} onChange={setTheme} />
        <output data-testid="theme-value">{theme}</output>
        <ColorPicker value={color} onChange={setColor} colors={[
          { value: "#123456", label: "Ocean" }, { value: "#654321", label: "Earth", disabled: true },
        ]} />
        <output data-testid="color-value">{color ?? "none"}</output>
        <Pagination page={page} total={45} itemLabel="record" onPageChange={setPage} />
      </form>
      <output data-testid="submit-count">{submissions}</output>
      <DataTable caption="Interactive records" data={[{ id: "a", name: "First record" }, { id: "b", name: "Second record" }]}
        getRowKey={(row) => row.id} columns={[{ key: "name", header: "Name", render: (row) => row.name }]}
        onRowClick={(row) => setSelected(row.name)} onRowIntent={(row) => setIntent(row.name)} />
      <output data-testid="selected-record">{selected}</output>
      <output data-testid="intended-record">{intent}</output>
    </section>
  );
}
