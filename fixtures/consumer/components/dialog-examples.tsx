"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@cosborn2/ui/button";
import { Input } from "@cosborn2/ui/input";
import { Modal } from "@cosborn2/ui/modal";
import { ConfirmDialog } from "@cosborn2/ui/confirm-dialog";
import * as RadixDialog from "@radix-ui/react-dialog";

function ImmediateEscape({ enabled, onEscape }: { enabled: boolean; onEscape: () => void }) {
  const target = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (!enabled || !target.current) return;
    // Deliver input in the opening commit, before passive effects can hand off
    // the active dialog. Waiting for opacity/focus would hide this regression.
    target.current.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    onEscape();
  }, [enabled, onEscape]);
  return <Input ref={target} label="Nested name" />;
}

export function DialogExamples({ initialOpen = false, children }: { initialOpen?: boolean; children?: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(initialOpen);
  const [nested, setNested] = useState(false);
  const [rapidEscape, setRapidEscape] = useState(false);
  const [persistentNested, setPersistentNested] = useState(false);
  const [radixOpen, setRadixOpen] = useState(false);
  const [conditionalNested, setConditionalNested] = useState(false);
  const [immediate, setImmediate] = useState(false);
  const [together, setTogether] = useState(false);
  const [togetherChild, setTogetherChild] = useState(false);
  const [bodyPortal, setBodyPortal] = useState<HTMLElement | null>(null);
  const [rapidEscapes, setRapidEscapes] = useState(0);
  const reportRapidEscape = useCallback(() => setRapidEscapes((count) => count + 1), []);
  const [confirm, setConfirm] = useState(false);
  const [persistent, setPersistent] = useState(false);
  const [light, setLight] = useState(false);
  const [scoped, setScoped] = useState(false);
  const [inherited, setInherited] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [confirmed, setConfirmed] = useState(0);
  const [guarded, setGuarded] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [handoffFirst, setHandoffFirst] = useState(false);
  const [handoffSecond, setHandoffSecond] = useState(false);
  useEffect(() => { setBodyPortal(document.body); setHydrated(true); }, []);

  return (
    <div data-testid="fixture" data-hydrated={hydrated ? "true" : "false"}>
      <h1>Package interaction fixture</h1>
      <p>This page uses the installed npm tarball and no Tailwind.</p>
      <a href="#after-controls">Background link</a>
      <div className="fixture-actions">
        <Modal
          open={open}
          // Inline callback deliberately refreshes the marker ref on re-renders;
          // this must never lift the parent above an already-open child.
          onOpenChange={(value) => setOpen(value)}
          title="Parent dialog"
          subtitle="Focus stays within the active dialog."
          trigger={<Button>Open parent</Button>}
          footer={<Button type="button" onClick={() => setOpen(false)}>Finish parent</Button>}
        >
          <Input label="Parent name" />
          {children}
          <Modal
            open={nested}
            onOpenChange={setNested}
            title="Nested dialog"
            persistent={persistentNested}
            trigger={<Button>Open nested</Button>}
          >
            <ImmediateEscape enabled={rapidEscape} onEscape={reportRapidEscape} />
            <Button type="button" onClick={() => setNested(false)}>Finish nested</Button>
          </Modal>
          <Button type="button" onClick={() => { setRapidEscape(true); setNested(true); }}>Open nested with immediate Escape</Button>
          <Button type="button" onClick={() => { setPersistentNested(true); setRapidEscape(true); setNested(true); }}>Open persistent nested with immediate Escape</Button>
          <Button type="button" onClick={() => setConditionalNested(true)}>Mount nested with immediate Escape</Button>
          {conditionalNested && <Modal open onOpenChange={setConditionalNested} portalContainer={bodyPortal} title="Conditional nested dialog">
            <ImmediateEscape enabled onEscape={reportRapidEscape} />
          </Modal>}
          <output data-testid="rapid-escapes">{rapidEscapes}</output>
          <RadixDialog.Root open={radixOpen} onOpenChange={setRadixOpen}>
            <RadixDialog.Trigger asChild><Button>Open Radix child</Button></RadixDialog.Trigger>
            <RadixDialog.Portal>
              <RadixDialog.Content className="bnh-modal" style={{ zIndex: 101, padding: 24 }} aria-describedby={undefined}>
                <RadixDialog.Title>Radix child dialog</RadixDialog.Title>
                <Input label="Radix child name" />
                <RadixDialog.Close asChild><Button>Close Radix child</Button></RadixDialog.Close>
              </RadixDialog.Content>
            </RadixDialog.Portal>
          </RadixDialog.Root>
        </Modal>
        <Button type="button" onClick={() => setImmediate(true)}>Mount immediate dialog</Button>
        {immediate && <Modal open onOpenChange={setImmediate} portalContainer={bodyPortal} title="Immediate dialog">
          <ImmediateEscape enabled onEscape={reportRapidEscape} />
        </Modal>}
        <Button type="button" onClick={() => { setTogether(true); setTogetherChild(true); }}>Mount both dialogs with immediate Escape</Button>
        {together && <Modal open onOpenChange={setTogether} portalContainer={bodyPortal} title="Simultaneous parent">
          <Input label="Simultaneous parent name" />
          {togetherChild && <Modal open onOpenChange={setTogetherChild} portalContainer={bodyPortal} title="Simultaneous child">
            <ImmediateEscape enabled onEscape={reportRapidEscape} />
          </Modal>}
        </Modal>}
        <output data-testid="all-rapid-escapes">{rapidEscapes}</output>
        <Button type="button" onClick={() => setConfirm(true)}>Open confirmation</Button>
        <ConfirmDialog
          open={confirm}
          title="Delete example"
          message="Type the confirmation phrase."
          typeToConfirm="DELETE"
          confirmLabel="Delete item"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirmed((value) => value + 1); setConfirm(false); }}
        />
        <output data-testid="confirmed-count">{confirmed}</output>
        <Button type="button" onClick={() => { setPassword(""); setGuarded(true); }}>Open guarded confirmation</Button>
        <ConfirmDialog
          open={guarded}
          title="Verify deletion"
          message="Reauthenticate before deleting."
          typeToConfirm="DELETE"
          confirmLabel="Verify and delete"
          confirmDisabled={password.length === 0}
          loading={verifying}
          onCancel={() => setGuarded(false)}
          onConfirm={() => setVerifying(true)}
        >
          <Input type="password" label="Verification password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {verifying && <Button type="button" onClick={() => { setVerifying(false); setGuarded(false); }}>Complete verification</Button>}
        </ConfirmDialog>
        <Modal open={handoffFirst} onOpenChange={setHandoffFirst} title="First handoff dialog" trigger={<Button>Open handoff dialog</Button>}>
          <Button type="button" onClick={() => { setHandoffFirst(false); setHandoffSecond(true); }}>Continue to second dialog</Button>
        </Modal>
        <Modal open={handoffSecond} onOpenChange={setHandoffSecond} title="Second handoff dialog">
          <Input label="Second dialog field" autoFocus />
        </Modal>
        <Modal
          open={persistent}
          onOpenChange={setPersistent}
          persistent
          title="Persistent dialog"
          trigger={<Button>Open persistent</Button>}
        >
          <Button type="button" onClick={() => setPersistent(false)}>Finish persistent</Button>
        </Modal>
        <Modal
          open={light}
          onOpenChange={setLight}
          theme="light"
          title="Light dialog"
          trigger={<Button>Open light dialog</Button>}
        >
          <p>Explicit light theme while the document uses dark.</p>
        </Modal>
      </div>
      <section data-bnh-theme="light" data-testid="scoped-theme" style={{ "--bnh-accent": "rgb(12, 34, 56)" } as CSSProperties}>
        <Modal
          open={scoped}
          onOpenChange={setScoped}
          portalContainer={portalContainer}
          title="Scoped dialog"
          trigger={<Button>Open scoped dialog</Button>}
        >
          <p>The portal inherits this region's theme and custom accent.</p>
        </Modal>
        <div ref={setPortalContainer} data-testid="scoped-portal" />
      </section>
      <section data-bnh-theme="light" data-testid="inherited-theme" style={{ "--bnh-accent": "rgb(65, 43, 21)" } as CSSProperties}>
        <Modal open={inherited} onOpenChange={setInherited} title="Inherited dialog" trigger={<Button>Open inherited dialog</Button>}>
          <p>Body portal copies its origin's scoped theme and custom tokens.</p>
        </Modal>
      </section>
      <div id="after-controls" className="fixture-scroll-space">Background content</div>
    </div>
  );
}
