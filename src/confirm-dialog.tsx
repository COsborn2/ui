"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./button.js";
import { Input } from "./input.js";
import { Modal } from "./modal.js";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  typeToConfirm?: string;
  /** Additional content such as a password field or verification notice. */
  children?: ReactNode;
  /** App-owned prerequisites, combined with loading and typed confirmation. */
  confirmDisabled?: boolean;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  // Unmounting the form resets the typed phrase each time the dialog closes.
  return props.open ? <Confirmation key={props.typeToConfirm} {...props} /> : null;
}

function Confirmation({ title, message, confirmLabel = "Confirm", confirmVariant = "primary", onConfirm, onCancel, loading = false, typeToConfirm, children, confirmDisabled = false }: ConfirmDialogProps) {
  const [value, setValue] = useState("");
  const disabled = loading || confirmDisabled || (typeToConfirm !== undefined && value !== typeToConfirm);
  return (
    <Modal open onOpenChange={(next) => { if (!next) onCancel(); }} title={title} persistent={loading} width={448} zIndex={300}
      footer={<div className="bnh-confirm-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={disabled}>{loading ? "Loading..." : confirmLabel}</Button>
      </div>}
    >
      <p className="bnh-confirm-message">{message}</p>
      {children}
      {typeToConfirm !== undefined && <Input wrapperClassName="bnh-confirm-input" label={`Type ${typeToConfirm} to confirm`} value={value} onChange={(event) => setValue(event.target.value)} autoFocus />}
    </Modal>
  );
}
