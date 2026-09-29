import { describe, expect, test, vi } from "vitest";
import { createRef } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toast, ToastViewport } from "../src/toast.js";

describe("Toast", () => {
  test("announces only its message and keeps keyboard actions outside that live region", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    const dismiss = vi.fn();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><Toast message="Save failed" variant="error" onDismiss={dismiss}
      action={{ label: "Retry", ariaLabel: "Retry saving", onClick: action }} /></form>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Save failed");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveAttribute("aria-atomic", "true");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Retry saving" });
    retry.focus();
    await user.keyboard("{Enter}");
    expect(action).toHaveBeenCalledOnce();
    expect(dismiss).not.toHaveBeenCalled();
    expect(alert).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  test("uses polite announcements by default and supports explicit announcement overrides", () => {
    const { rerender } = render(<Toast message="Saved" variant="success" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<Toast message="Important update" announce="assertive" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Important update");
    rerender(<Toast message="Already announced" announce="off" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Already announced")).toHaveAttribute("aria-live", "off");
  });

  test("does not invoke a disabled action and supports a custom dismiss name", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    const dismiss = vi.fn();
    render(<Toast message="Archived" action={{ label: "Undo", disabled: true, onClick: action }}
      onDismiss={dismiss} dismissLabel="Dismiss archived notice" />);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Dismiss archived notice" }));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  test("forwards native refs and focus/hover events for host composition", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const hover = vi.fn();
    const focus = vi.fn();
    render(<Toast ref={ref} message="Archived" className="app-toast" onMouseEnter={hover} onFocusCapture={focus}
      onDismiss={vi.fn()} />);
    expect(ref.current).toHaveClass("app-toast");
    await user.hover(screen.getByText("Archived"));
    expect(hover).toHaveBeenCalledOnce();
    act(() => screen.getByRole("button", { name: "Dismiss notification" }).focus());
    expect(focus).toHaveBeenCalledOnce();
  });

  test("keeps progress updates outside its live message", () => {
    const { rerender } = render(<Toast message="Saved" progress={1} />);
    const message = screen.getByRole("status");
    const content = message.firstChild;
    rerender(<Toast message="Saved" progress={0.25} />);
    expect(screen.getByRole("status")).toBe(message);
    expect(message.firstChild).toBe(content);
    expect(message).toHaveTextContent("Saved");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  test("preserves empty announcement regions as messages arrive without duplicating controls", () => {
    const { rerender } = render(<ToastViewport announcements={{}} />);
    const polite = screen.getByRole("status");
    const assertive = screen.getByRole("alert");
    expect(polite).toBeEmptyDOMElement();
    expect(assertive).toBeEmptyDOMElement();
    rerender(<ToastViewport aria-label="Upload notifications" announcements={{ polite: <span key="upload">Upload complete</span> }}>
      <Toast message="Upload complete" announce="off" onDismiss={vi.fn()} />
    </ToastViewport>);
    expect(screen.getByRole("status")).toBe(polite);
    expect(screen.getByRole("alert")).toBe(assertive);
    expect(polite).toHaveTextContent("Upload complete");
    expect(polite).toHaveAttribute("aria-relevant", "additions text");
    expect(polite).toHaveAttribute("aria-atomic", "false");
    expect(within(polite).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Upload notifications" })).toContainElement(screen.getByRole("button", { name: "Dismiss notification" }));
  });

});
