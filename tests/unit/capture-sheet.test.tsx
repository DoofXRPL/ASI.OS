// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  captureShortcutKeys,
  captureShortcutLabel,
  isApplePlatform,
  isCaptureShortcut,
  opensSheetInPlace,
  SHEET_CAPTURE_FIELD_ID,
} from "@/components/os/capture-shortcut";
import { Dialog } from "@/components/ui/dialog";
import {
  CAPTURE_MAX_CHARACTERS,
  captureCharactersLeft,
} from "@/lib/schemas/inbox";

/**
 * The quick capture sheet.
 *
 * Most of what matters here is a rule rather than a rendering, so the rules are
 * tested as the pure functions they are. The rest is behaviour that only exists
 * in a document: that dismissing the sheet does not discard a draft, that the
 * modal is opened by method rather than by attribute, and that nothing has
 * quietly appeared in a form whose whole promise is that it asks nothing.
 */

// The real action reaches for a session, a database and a cookie store. What is
// under test is the form, not the write it performs.
const captured: string[] = [];
vi.mock("@/app/(os)/inbox/actions", () => ({
  captureInboxItemAction: async (_previous: unknown, formData: FormData) => {
    captured.push(String(formData.get("content") ?? ""));
    return { error: null, capturedAt: Date.now() };
  },
}));

// `next/link` needs a mounted App Router. The invariant worth asserting is that
// the trigger is an anchor with a working href, which survives the substitution.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const pathname = { current: "/today" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

afterEach(() => {
  cleanup();
  captured.length = 0;
  pathname.current = "/today";
});

describe("the capture shortcut", () => {
  const base = {
    key: "c",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  };

  it("matches Control+Shift+C", () => {
    expect(isCaptureShortcut({ ...base, ctrlKey: true, shiftKey: true })).toBe(
      true,
    );
  });

  it("matches Command+Shift+C, so one handler serves both platforms", () => {
    expect(isCaptureShortcut({ ...base, metaKey: true, shiftKey: true })).toBe(
      true,
    );
  });

  it("accepts the uppercase key a held Shift actually produces", () => {
    expect(
      isCaptureShortcut({ ...base, key: "C", ctrlKey: true, shiftKey: true }),
    ).toBe(true);
  });

  it("ignores the combination without Shift, which is Copy", () => {
    expect(isCaptureShortcut({ ...base, ctrlKey: true })).toBe(false);
  });

  it("ignores Alt, because ⌥ combinations type characters", () => {
    expect(
      isCaptureShortcut({
        ...base,
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
      }),
    ).toBe(false);
  });

  it("ignores a repeat from a held key", () => {
    expect(
      isCaptureShortcut({
        ...base,
        ctrlKey: true,
        shiftKey: true,
        repeat: true,
      }),
    ).toBe(false);
  });

  it("ignores every other letter", () => {
    expect(
      isCaptureShortcut({ ...base, key: "k", ctrlKey: true, shiftKey: true }),
    ).toBe(false);
  });
});

describe("clicks on the Capture trigger", () => {
  const plain = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  };

  it("takes over a plain left click", () => {
    expect(opensSheetInPlace(plain)).toBe(true);
  });

  it("leaves ⌘-click to the browser, which opens a new tab", () => {
    expect(opensSheetInPlace({ ...plain, metaKey: true })).toBe(false);
    expect(opensSheetInPlace({ ...plain, ctrlKey: true })).toBe(false);
  });

  it("leaves Shift-click and Alt-click alone", () => {
    expect(opensSheetInPlace({ ...plain, shiftKey: true })).toBe(false);
    expect(opensSheetInPlace({ ...plain, altKey: true })).toBe(false);
  });

  it("leaves the middle button alone", () => {
    expect(opensSheetInPlace({ ...plain, button: 1 })).toBe(false);
  });
});

describe("how the shortcut is written down", () => {
  it("reads an Apple platform from what the browser reports", () => {
    expect(isApplePlatform("MacIntel")).toBe(true);
    expect(isApplePlatform("iPhone")).toBe(true);
    expect(isApplePlatform("Win32")).toBe(false);
    expect(isApplePlatform("Linux x86_64")).toBe(false);
  });

  it("uses the symbols the keyboard in front of the reader has", () => {
    expect(captureShortcutKeys(true)).toEqual(["⌘", "⇧", "C"]);
    expect(captureShortcutKeys(false)).toEqual(["Ctrl", "Shift", "C"]);
    expect(captureShortcutLabel(true)).toBe("⌘⇧C");
    expect(captureShortcutLabel(false)).toBe("Ctrl+Shift+C");
  });
});

describe("the character counter", () => {
  it("says nothing until the limit is close", () => {
    expect(captureCharactersLeft(0)).toBeNull();
    expect(captureCharactersLeft(100)).toBeNull();
  });

  it("counts down once it is", () => {
    expect(captureCharactersLeft(CAPTURE_MAX_CHARACTERS - 200)).toBe(200);
    expect(captureCharactersLeft(CAPTURE_MAX_CHARACTERS - 1)).toBe(1);
    expect(captureCharactersLeft(CAPTURE_MAX_CHARACTERS)).toBe(0);
  });
});

describe("Dialog", () => {
  function Harness({ open }: { open: boolean }) {
    return (
      <Dialog open={open} onDismiss={() => {}} labelledBy="h">
        <div>
          <h2 id="h">Sheet</h2>
          <textarea aria-label="draft" defaultValue="" />
        </div>
      </Dialog>
    );
  }

  it("keeps its children mounted while closed, so a draft can survive", () => {
    render(<Harness open={false} />);
    expect(screen.getByLabelText("draft")).toBeTruthy();
  });

  it("opens by calling showModal rather than by rendering an open attribute", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const { rerender, container } = render(<Harness open={false} />);
    const dialog = container.querySelector("dialog");

    // A rendered `<dialog open>` is a non-modal dialog: no focus trap, no inert
    // background, no top layer. React must never be the one to set it.
    expect(dialog?.hasAttribute("open")).toBe(false);
    expect(showModal).not.toHaveBeenCalled();

    rerender(<Harness open={true} />);
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(dialog?.open).toBe(true);
    showModal.mockRestore();
  });

  it("closes the element when the prop goes back to false", () => {
    const close = vi.spyOn(HTMLDialogElement.prototype, "close");
    const { rerender } = render(<Harness open={true} />);
    rerender(<Harness open={false} />);
    expect(close).toHaveBeenCalledTimes(1);
    close.mockRestore();
  });

  it("reports Escape instead of letting the browser close it behind React", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Dialog open={true} onDismiss={onDismiss} labelledBy="h">
        <h2 id="h">Sheet</h2>
      </Dialog>,
    );

    const dialog = container.querySelector("dialog");
    const cancel = new Event("cancel", { bubbles: false, cancelable: true });
    fireEvent(dialog!, cancel);

    expect(onDismiss).toHaveBeenCalled();
    expect(cancel.defaultPrevented).toBe(true);
  });

  it("treats a click on the dialog itself as the backdrop, and content as content", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Dialog open={true} onDismiss={onDismiss} labelledBy="h">
        <h2 id="h">Sheet</h2>
      </Dialog>,
    );

    fireEvent.click(screen.getByText("Sheet"));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector("dialog")!);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("the capture sheet", () => {
  async function renderSheet() {
    const { QuickCapture } = await import("@/components/os/quick-capture");
    return render(<QuickCapture />);
  }

  it("offers a link to the inbox field, so capture works before hydration", async () => {
    await renderSheet();
    const trigger = screen.getByRole("link", { name: /capture/i });
    expect(trigger.getAttribute("href")).toBe("/inbox#capture");
  });

  it("gives the sheet's field an id of its own", async () => {
    const { container } = await renderSheet();
    const field = container.querySelector("dialog textarea");
    expect(field?.getAttribute("id")).toBe(SHEET_CAPTURE_FIELD_ID);
    expect(field?.getAttribute("id")).not.toBe("capture");
  });

  it("asks for nothing but the thought itself", async () => {
    const { container } = await renderSheet();
    const sheet = container.querySelector("dialog")!;

    const named = [...sheet.querySelectorAll("[name]")].map((el) =>
      el.getAttribute("name"),
    );
    expect(named).toEqual(["content"]);

    // No kind, no project, no title: metadata in capture is the processing
    // decision moved into the moment a thought arrives.
    expect(sheet.querySelector("select")).toBeNull();
    expect(sheet.querySelector("input")).toBeNull();
  });

  it("keeps a half-written draft across a dismissal", async () => {
    const { container } = await renderSheet();
    const trigger = screen.getByRole("link", { name: /capture/i });
    const field = container.querySelector<HTMLTextAreaElement>(
      "dialog textarea",
    )!;

    fireEvent.click(trigger);
    fireEvent.change(field, { target: { value: "half a thought" } });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(container.querySelector("dialog")?.open).toBe(false);
    expect(field.value).toBe("half a thought");

    fireEvent.click(trigger);
    expect(container.querySelector("dialog")?.open).toBe(true);
    expect(field.value).toBe("half a thought");
  });

  it("counts down near the limit and forgets the count when the field resets", async () => {
    const { container } = await renderSheet();
    const form = container.querySelector("dialog form")!;
    const field = container.querySelector<HTMLTextAreaElement>(
      "dialog textarea",
    )!;

    fireEvent.change(field, {
      target: { value: "x".repeat(CAPTURE_MAX_CHARACTERS - 40) },
    });
    expect(form.textContent).toContain("40 left");

    fireEvent.reset(form);
    expect(form.textContent).not.toContain("left");
  });
});
