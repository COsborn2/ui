import { describe, expect, test, vi } from "vitest";
import { createRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Notice } from "../src/notice.js";

describe("Notice", () => {
  test("renders static feedback without forcing a live region or action", () => {
    render(<Notice tone="danger" heading="Account restricted">Contact your administrator.</Notice>);
    expect(screen.getByText("Account restricted")).toBeVisible();
    expect(screen.getByText("Contact your administrator.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("lets callers announce a changing status and switch to an alert", () => {
    const { rerender } = render(<Notice tone="success" role="status" aria-atomic="true">Preferences saved.</Notice>);
    expect(screen.getByRole("status")).toHaveTextContent("Preferences saved.");
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
    rerender(<Notice tone="danger" role="alert">Could not save.</Notice>);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("keeps actions accessible while treating supplied icons as decorative", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<Notice heading={<h2>Verify your email</h2>} icon={<svg role="img" aria-label="Decorative mail" />}
      actions={<><a href="/verify">Review details</a><button onClick={retry}>Send again</button></>}>
      <p>We sent a link to <strong>alex@example.com</strong>.</p>
    </Notice>);
    expect(screen.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Review details" })).toHaveAttribute("href", "/verify");
    expect(screen.queryByRole("img", { name: "Decorative mail" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test("allows the consumer to dismiss a notice through its action slot", async () => {
    function DismissibleNotice() {
      const [visible, setVisible] = useState(true);
      return visible ? <Notice role="status" actions={<button onClick={() => setVisible(false)}>Dismiss notice</button>}>Settings updated.</Notice> : <p>Notice dismissed.</p>;
    }
    const user = userEvent.setup();
    render(<DismissibleNotice />);
    await user.click(screen.getByRole("button", { name: "Dismiss notice" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Notice dismissed.")).toBeVisible();
  });

  test("forwards native attributes, refs and caller styles to the rendered element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Notice ref={ref} id="account-notice" title="More information" role="note" aria-label="Account information"
      className="custom-notice" style={{ padding: 24 }}>Read &lt;carefully&gt;.</Notice>);
    const notice = screen.getByRole("note", { name: "Account information" });
    expect(ref.current).toBe(notice);
    expect(notice).toHaveAttribute("id", "account-notice");
    expect(notice).toHaveAttribute("title", "More information");
    expect(notice).toHaveClass("custom-notice");
    expect(notice).toHaveStyle({ padding: "24px" });
    expect(notice).toHaveTextContent("Read <carefully>.");
  });
});
