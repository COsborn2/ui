"use client";

import { useEffect, useRef, useState } from "react";
import { Toast, ToastViewport, type ToastVariant } from "@cosborn2/ui/toast";

interface ExampleNotification {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
  actionable?: boolean;
}

// A small host deliberately owns timing and persistence; the package only renders.
function HostedToast({ notification, onDismiss, onAction }: {
  notification: ExampleNotification;
  onDismiss: () => void;
  onAction: () => void;
}) {
  const remainingTime = useRef(notification.duration);
  const [remaining, setRemaining] = useState(notification.duration);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused || notification.duration === 0) return;
    const started = performance.now();
    const initial = remainingTime.current;
    const timer = setInterval(() => {
      const next = Math.max(0, initial - (performance.now() - started));
      remainingTime.current = next;
      setRemaining(next);
      if (next === 0) {
        clearInterval(timer);
        onDismiss();
      }
    }, 50);
    return () => {
      clearInterval(timer);
      remainingTime.current = Math.max(0, initial - (performance.now() - started));
    };
  }, [hovered, focused, notification.duration, onDismiss]);
  return <Toast
    data-testid={`toast-${notification.id}`}
    data-remaining={remaining}
    message={notification.message}
    variant={notification.variant}
    announce="off"
    progress={notification.duration > 0 ? remaining / notification.duration : undefined}
    onDismiss={onDismiss}
    dismissLabel={`Dismiss notification ${notification.id}`}
    action={notification.actionable ? { label: "Undo", ariaLabel: "Undo archive", onClick: onAction } : undefined}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
  />;
}

export function ToastExamples() {
  const [notifications, setNotifications] = useState<ExampleNotification[]>([]);
  const [actions, setActions] = useState(0);
  const [submissions, setSubmissions] = useState(0);
  const nextId = useRef(0);
  const show = (variant: ToastVariant, duration: number, actionable = false) => {
    setNotifications([{
      id: ++nextId.current,
      variant, duration, actionable,
      message: variant === "error"
        ? "Could not save the changes. This complete error message must remain readable on a narrow screen until you dismiss it."
        : actionable ? "Board archived." : "Draft saved successfully.",
    }]);
  };
  const dismiss = (id: number) => setNotifications((current) => current.filter((notification) => notification.id !== id));
  return <section data-testid="toast-examples">
    <h2>Controlled notifications</h2>
    <div className="fixture-actions">
      <button type="button" onClick={() => show("success", 1500)}>Show timed toast</button>
      <button type="button" onClick={() => show("error", 0)}>Show persistent error</button>
      <button type="button" onClick={() => show("info", 1500, true)}>Show actionable toast</button>
      <button type="button" onClick={() => setNotifications(Array.from({ length: 12 }, (_, index) => ({
        id: ++nextId.current, variant: "error", duration: 0,
        message: `Persistent message ${index + 1}. A long description stays readable and its dismiss button stays reachable when notifications fill the available screen.`,
      })))}>Show long toast stack</button>
      <button type="button" onClick={() => setNotifications([])}>Clear toast examples</button>
    </div>
    <output data-testid="toast-actions">{actions}</output>
    <output data-testid="toast-submissions">{submissions}</output>
    <form onSubmit={(event) => { event.preventDefault(); setSubmissions((count) => count + 1); }}>
      <ToastViewport aria-label="Example notifications" data-testid="toast-viewport" announcements={{
        polite: notifications.filter((notification) => notification.variant !== "error").map((notification) => <span key={notification.id}>{notification.message}</span>),
        assertive: notifications.filter((notification) => notification.variant === "error").map((notification) => <span key={notification.id}>{notification.message}</span>),
      }}>
        {notifications.map((notification) => <HostedToast key={notification.id} notification={notification}
          onDismiss={() => dismiss(notification.id)}
          onAction={() => { setActions((count) => count + 1); dismiss(notification.id); }} />)}
      </ToastViewport>
    </form>
  </section>;
}
