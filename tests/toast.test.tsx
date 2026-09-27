import { describe, expect, test } from "bun:test";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Toast, ToastViewport } from "../src/toast.js";

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const result: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (isValidElement<Record<string, unknown>>(child)) result.push(child, ...elements(child.props.children as ReactNode));
  });
  return result;
}

describe("controlled toast presentation", () => {
  test("renders static message HTML without browser globals or handlers", () => {
    const tree = Toast({ message: "Saved", variant: "success" });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true">Saved</div>');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("bnh-toast__ring-progress");
    for (const element of elements(tree)) {
      expect(Object.keys(element.props).filter((name) => /^on[A-Z]/.test(name))).toEqual([]);
    }
  });

  test("announces errors assertively and keeps controls outside the live message", () => {
    const html = renderToStaticMarkup(<Toast message="Save failed" variant="error" onDismiss={() => {}}
      action={{ label: "Retry", ariaLabel: "Retry saving", onClick: () => {} }} />);
    expect(html).toContain('role="alert" aria-live="assertive" aria-atomic="true">Save failed</div>');
    expect(html).toContain('aria-label="Retry saving"');
    expect(html).toContain('aria-label="Dismiss notification"');
    expect(html.match(/type="button"/g)).toHaveLength(2);
    expect(html.match(/aria-live=/g)).toHaveLength(1);
  });

  test("accepts a caller-owned announcer without creating another live role", () => {
    const html = renderToStaticMarkup(<Toast message="Already announced" announce="off" dismissLabel="Dismiss saved notice" onDismiss={() => {}} />);
    expect(html).toContain('aria-live="off"');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('aria-label="Dismiss saved notice"');
  });

  test("clamps decorative progress and does not expose it as an announcement", () => {
    const full = renderToStaticMarkup(<Toast message="Saved" progress={2} />);
    const empty = renderToStaticMarkup(<Toast message="Saved" progress={-1} />);
    expect(full).toContain('stroke-dashoffset="0"');
    expect(empty).toContain('stroke-dashoffset="1"');
    expect(full).toContain('class="bnh-toast__indicator" aria-hidden="true"');
    expect(full).not.toContain('role="progressbar"');
  });

  test("leaves action-dismiss policy to the host and forwards event/ref composition", () => {
    let actions = 0;
    let dismissals = 0;
    const onMouseEnter = () => {};
    const onFocusCapture = () => {};
    const ref = { current: null };
    const tree = Toast({ message: "Archived", className: "app-toast", ref, onMouseEnter, onFocusCapture,
      action: { label: "Undo", onClick: () => { actions++; } }, onDismiss: () => { dismissals++; } });
    expect(tree.props.ref).toBe(ref);
    expect(tree.props.onMouseEnter).toBe(onMouseEnter);
    expect(tree.props.onFocusCapture).toBe(onFocusCapture);
    const buttons = elements(tree).filter((element) => element.type === "button");
    (buttons[0].props.onClick as () => void)();
    expect(actions).toBe(1);
    expect(dismissals).toBe(0);
    (buttons[1].props.onClick as () => void)();
    expect(dismissals).toBe(1);
  });

  test("persistent announcers exist when empty and contain only supplied message content", () => {
    const empty = renderToStaticMarkup(<ToastViewport announcements={{}} />);
    expect(empty).toContain('aria-live="polite" aria-atomic="false" aria-relevant="additions text"></div>');
    expect(empty).toContain('aria-live="assertive" aria-atomic="false" aria-relevant="additions text"></div>');
    const html = renderToStaticMarkup(<ToastViewport aria-label="Upload notifications" style={{ bottom: 80 }}
      announcements={{ polite: <span>Upload complete</span> }}><Toast message="Upload complete" announce="off" onDismiss={() => {}} /></ToastViewport>);
    expect(html).toContain('aria-label="Upload notifications"');
    expect(html).toContain('style="bottom:80px"');
    expect(html).toContain('aria-relevant="additions text"><span>Upload complete</span></div>');
  });
});
