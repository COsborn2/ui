import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { CircleAlert, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../src/button.js";
import { Notice } from "../src/notice.js";
import { Toast, ToastViewport, type ToastVariant } from "../src/toast.js";

const meta = {
  title: "Feedback/Notices and toasts",
  parameters: { layout: "padded", docs: { story: { inline: false, height: "480px" } } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoticeTones: Story = {
  render: () => <div style={{ display: "grid", gap: 16, maxWidth: 600 }}>
    <Notice heading="Scheduled maintenance">Your work is saved automatically.</Notice>
    <Notice tone="success" heading="Preferences updated" icon={<Check size={18} />}>Your new settings apply immediately.</Notice>
    <Notice tone="danger" heading="Connection interrupted" icon={<CircleAlert size={18} />}
      actions={<a href="#connection-help" style={{ color: "var(--bnh-link)" }}>Connection help</a>}>Your local changes will sync when you reconnect.</Notice>
  </div>,
};

export const NoticeTonesLight: Story = {
  ...NoticeTones,
  globals: { theme: "light" },
};

function DismissibleNotice() {
  const [visible, setVisible] = useState(true);
  return visible ? <Notice role="status" tone="success" heading="Preferences saved"
    actions={<Button variant="ghost" onClick={() => setVisible(false)}>Dismiss notice</Button>}>
    Notifications now follow your updated preferences.
  </Notice> : <Button onClick={() => setVisible(true)}>Show notice again</Button>;
}

export const DismissibleStatus: Story = {
  render: () => <DismissibleNotice />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Preferences saved");
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss notice" }));
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Show notice again" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Preferences saved");
  },
};

interface Notification {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
  actionable?: boolean;
}

// This is consumer policy: the library renders controlled feedback without a store or timer.
function HostedToast({ notification, onDismiss, onUndo }: {
  notification: Notification;
  onDismiss: () => void;
  onUndo: () => void;
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
      if (next === 0) onDismiss();
    }, 50);
    return () => {
      clearInterval(timer);
      remainingTime.current = Math.max(0, initial - (performance.now() - started));
    };
  }, [hovered, focused, notification.duration, onDismiss]);
  return <Toast message={notification.message} variant={notification.variant} announce="off"
    data-paused={hovered || focused} progress={notification.duration > 0 ? remaining / notification.duration : undefined}
    onDismiss={onDismiss} dismissLabel={`Dismiss notification ${notification.id}`}
    action={notification.actionable ? { label: "Undo", ariaLabel: "Undo archive", onClick: onUndo } : undefined}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} />;
}

function NotificationHost() {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [actions, setActions] = useState(0);
  const [submissions, setSubmissions] = useState(0);
  const nextId = useRef(0);
  const dismiss = useCallback(() => setNotification(null), []);
  return <section aria-label="Controlled notification examples">
    <h2>Controlled notifications</h2>
    <p>The consumer owns persistence, timing and pause-on-hover or focus behavior.</p>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Button onClick={() => setNotification({ id: ++nextId.current, message: "Item archived.", variant: "info", duration: 30_000, actionable: true })}>Show actionable toast</Button>
      <Button onClick={() => setNotification({ id: ++nextId.current, message: "Could not save your changes. Try again when your connection is restored.", variant: "error", duration: 0 })}>Show persistent error</Button>
      <Button onClick={dismiss}>Clear notifications</Button>
    </div>
    <p>Actions completed: {actions}</p>
    <p>Form submissions: {submissions}</p>
    <form onSubmit={(event) => { event.preventDefault(); setSubmissions((count) => count + 1); }}>
      <ToastViewport announcements={{
        polite: notification && notification.variant !== "error" ? <span key={notification.id}>{notification.message}</span> : undefined,
        assertive: notification?.variant === "error" ? <span key={notification.id}>{notification.message}</span> : undefined,
      }}>
        {notification && <HostedToast key={notification.id} notification={notification} onDismiss={dismiss}
          onUndo={() => { setActions((count) => count + 1); dismiss(); }} />}
      </ToastViewport>
    </form>
  </section>;
}

export const ControlledToasts: Story = {
  parameters: { docs: { description: { story: "Message-only live regions are present before notification insertion. Timing and persistence belong to this example host. The interaction checks verify hover/focus callback composition and host state; they do not verify elapsed timer behavior." } } },
  render: () => <NotificationHost />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const polite = canvas.getByRole("status");
    const assertive = canvas.getByRole("alert");
    await expect(polite).toBeEmptyDOMElement();
    await expect(assertive).toBeEmptyDOMElement();
    await userEvent.click(canvas.getByRole("button", { name: "Show actionable toast" }));
    await expect(canvas.getByRole("status")).toBe(polite);
    await expect(polite).toHaveTextContent("Item archived.");
    await expect(within(polite).queryByRole("button")).not.toBeInTheDocument();
    const viewport = canvas.getByRole("region", { name: "Notifications" });
    const undo = within(viewport).getByRole("button", { name: "Undo archive" });
    const toast = undo.parentElement!;
    await userEvent.hover(undo);
    await expect(toast).toHaveAttribute("data-paused", "true");
    undo.focus();
    await userEvent.unhover(undo);
    await expect(toast).toHaveAttribute("data-paused", "true");
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByText("Actions completed: 1")).toBeVisible();
    await expect(within(viewport).queryByRole("button")).not.toBeInTheDocument();
    await expect(canvas.getByText("Form submissions: 0")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Show persistent error" }));
    await expect(canvas.getByRole("alert")).toBe(assertive);
    await expect(assertive).toHaveTextContent("Could not save your changes.");
    await expect(assertive).toHaveAttribute("aria-relevant", "additions text");
    const dismiss = within(viewport).getByRole("button", { name: /Dismiss notification/ });
    dismiss.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(within(viewport).queryByRole("button")).not.toBeInTheDocument());
    await expect(canvas.getByText("Form submissions: 0")).toBeVisible();
  },
};

// Persistent content lets the automatic accessibility scan inspect every toast variant and control.
export const VisibleToastVariants: Story = {
  render: () => <ToastViewport>
    <Toast message="Preferences saved." variant="success" onDismiss={fn()} dismissLabel="Dismiss saved notice" />
    <Toast message="Item archived." variant="info" progress={0.5}
      action={{ label: "Undo", onClick: fn() }} onDismiss={fn()} dismissLabel="Dismiss archive notice" />
    <Toast message="Could not save your changes. Check your connection and try again." variant="error"
      action={{ label: "Retry", onClick: fn() }} onDismiss={fn()} dismissLabel="Dismiss save error" />
  </ToastViewport>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notifications = canvas.getByRole("region", { name: "Notifications" });
    await expect(within(notifications).getByRole("alert")).toHaveTextContent("Could not save your changes.");
    await expect(within(notifications).getAllByRole("status")).toHaveLength(2);
    await waitFor(() => expect(within(notifications).getByRole("button", { name: "Undo" })).toBeVisible());
    await waitFor(() => expect(within(notifications).getByRole("button", { name: "Retry" })).toBeVisible());
  },
};

export const VisibleToastVariantsLight: Story = {
  ...VisibleToastVariants,
  globals: { theme: "light" },
};
