"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ActionsMenu } from "@cosborn2/ui/actions-menu";
import { Button } from "@cosborn2/ui/button";
import { Input } from "@cosborn2/ui/input";
import { Modal } from "@cosborn2/ui/modal";

function ImmediateEscape({ report }: { report: () => void }) {
  const target = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    target.current?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    report();
  }, [report]);
  return <span ref={target}>!</span>;
}

export function ActionsMenuExamples() {
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState("none");
  const [rowActions, setRowActions] = useState(0);
  const [retained, setRetained] = useState(false);
  const [closeRequests, setCloseRequests] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rapid, setRapid] = useState(false);
  const [conditional, setConditional] = useState(false);
  const [rapidCount, setRapidCount] = useState(0);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const report = useCallback(() => setRapidCount((count) => count + 1), []);
  useEffect(() => { setBody(document.body); setHydrated(true); }, []);

  const items = [
    { id: "rename", label: "Rename record", onClick: () => setSelected("rename") },
    { id: "disabled", label: "Archive record", disabled: true, onClick: () => setSelected("disabled") },
    { id: "delete", label: "Delete record", variant: "danger" as const, onClick: () => setSelected("delete") },
    { id: "details", label: "Open details", onClick: () => setDialog(true) },
  ];

  return <section data-testid="actions-menu-fixture" data-hydrated={hydrated ? "true" : "false"}>
    <h2>Action menu examples</h2>
    <div data-testid="action-menu-row" onClick={() => setRowActions((count) => count + 1)} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") setRowActions((count) => count + 1);
    }}>
      <ActionsMenu ariaLabel="Record actions" items={items} />
    </div>
    <output data-testid="action-menu-selection">{selected}</output>
    <output data-testid="action-menu-row-activations">{rowActions}</output>
    <ActionsMenu ariaLabel="Unavailable actions" disabled items={items} />
    <ActionsMenu ariaLabel="Empty actions" items={[]} />
    <ActionsMenu items={items} trigger={<Button>Custom actions</Button>} />
    <ActionsMenu ariaLabel="Retained actions" open={retained} onOpenChange={(next) => {
      if (next) setRetained(true);
      else setCloseRequests((count) => count + 1);
    }} items={[{ label: "Retained action", onClick: () => {} }]} />
    <output data-testid="action-menu-close-requests">{closeRequests}</output>
    <section data-testid="actions-theme-region" data-bnh-theme="light" style={{ "--bnh-accent": "rgb(12, 34, 56)", "--bnh-bg-2": "rgb(245, 240, 230)" } as CSSProperties}>
      <ActionsMenu ariaLabel="Scoped actions" items={items} />
      <ActionsMenu ariaLabel="Container actions" portalContainer={container} items={items} />
      <ActionsMenu ariaLabel="Dark actions" theme="dark" items={items} />
      <div ref={setContainer} data-testid="actions-menu-portal" />
    </section>
    <Button onClick={() => setDialog(true)}>Open action menu dialog</Button>
    <Modal open={dialog} onOpenChange={setDialog} title="Action menu dialog" trigger={<Button>Show menu modal</Button>}>
      <Input label="Dialog field" />
      <ActionsMenu ariaLabel="Dialog actions" open={menu} onOpenChange={setMenu} items={[
        { label: "Keep parent open", onClick: () => setSelected("nested"), icon: rapid ? <ImmediateEscape report={report} /> : undefined },
      ]} />
      <Button onClick={() => { setRapid(true); setMenu(true); }}>Open menu with immediate Escape</Button>
      <Button onClick={() => setConditional(true)}>Mount menu with immediate Escape</Button>
      {conditional && <ActionsMenu ariaLabel="Conditional actions" open onOpenChange={setConditional} portalContainer={body} items={[
        { label: "Conditional action", onClick: () => {}, icon: <ImmediateEscape report={report} /> },
      ]} />}
      <output data-testid="action-menu-rapid-count">{rapidCount}</output>
    </Modal>
    <div style={{ position: "fixed", right: 4, bottom: 4 }}>
      <ActionsMenu ariaLabel="Corner actions" items={Array.from({ length: 30 }, (_, index) => ({
        label: `Corner action ${index + 1}`, onClick: () => setSelected(`corner-${index + 1}`),
      }))} />
    </div>
  </section>;
}
