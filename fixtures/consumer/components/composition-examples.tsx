"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClassName } from "@cosborn2/ui/button";
import { ExpandablePill } from "@cosborn2/ui/expandable-pill";
import { HeaderShell } from "@cosborn2/ui/header-shell";

export function CompositionExamples() {
  const [hydrated, setHydrated] = useState(false);
  const [consumedEscapes, setConsumedEscapes] = useState(0);
  const [portal, setPortal] = useState(false);
  const [refTargets, setRefTargets] = useState("");
  const [headerClicks, setHeaderClicks] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setHydrated(true); }, []);

  return (
    <section data-testid="composition-fixture" data-hydrated={hydrated ? "true" : "false"}>
      <h2>Component composition</h2>
      <a href="#composition-target" className={buttonClassName()}>Button-style link</a>
      <HeaderShell
        as="header"
        ref={headerRef}
        aria-label="Composition header"
        role="region"
        data-tour="composition-header"
        tabIndex={-1}
        style={{ position: "relative", left: 0, top: 0, transform: "none", marginTop: 16 }}
        onClick={() => setHeaderClicks((count) => count + 1)}
        left={<button type="button">Header action</button>}
        right={<span>Header slot</span>}
      />
      <HeaderShell
        ref={divRef}
        role="group"
        aria-label="Composition controls"
        style={{ position: "relative", left: 0, top: 0, transform: "none", marginTop: 16 }}
        left={<button type="button" onClick={() => setRefTargets(`${headerRef.current?.tagName}/${divRef.current?.tagName}`)}>Inspect header refs</button>}
      />
      <output data-testid="header-ref-targets">{refTargets}</output>
      <output data-testid="header-clicks">{headerClicks}</output>
      <div style={{ position: "relative", paddingTop: 16, marginBottom: 260 }}>
        <ExpandablePill panelAlign="center" panel={
          <div style={{ display: "grid", gap: 12, padding: 12, background: "var(--bnh-bg-2)", minWidth: 240 }}>
            <label>Panel field<input aria-label="Panel field" /></label>
            <label>Escape-owning field<input aria-label="Escape-owning field" onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setConsumedEscapes((count) => count + 1);
              }
            }} /></label>
            <ExpandablePill panel={<input aria-label="Nested panel field" />}>Nested disclosure</ExpandablePill>
            <button type="button" onClick={() => setPortal(true)}>Open portaled control</button>
            {portal && hydrated && createPortal(<input aria-label="Portaled field" onKeyDown={(event) => {
              if (event.key === "Escape") setPortal(false);
            }} />, document.body)}
          </div>
        }>Composition details</ExpandablePill>
        <output data-testid="consumed-escapes">{consumedEscapes}</output>
      </div>
      <div id="composition-target">Composition target</div>
    </section>
  );
}
