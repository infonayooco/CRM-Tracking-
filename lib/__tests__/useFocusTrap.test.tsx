import { useEffect, useRef } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFocusTrap } from "@/lib/useFocusTrap";

function TrapHarness() {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef);

  return (
    <div ref={containerRef}>
      <button type="button">first</button>
      <button type="button">middle</button>
      <button type="button">last</button>
    </div>
  );
}

// Mirrors the fixed call order in ItemModalContent / CustomerEditModalContent /
// CommandPaletteDialog (BUG 7): useFocusTrap is called BEFORE the component's
// own initial-focus effect, so useFocusTrap's effect captures the real
// trigger (document.activeElement at mount) before that later effect moves
// focus onto an inner field.
function TrapThenInitialFocusHarness() {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerFieldRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(containerRef);

  useEffect(() => {
    innerFieldRef.current?.focus();
  }, []);

  return (
    <div ref={containerRef}>
      <button ref={innerFieldRef} type="button">
        first
      </button>
      <button type="button">last</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves focus into the container on mount when focus started outside", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { getByText } = render(<TrapHarness />);

    expect(document.activeElement).toBe(getByText("first"));

    trigger.remove();
  });

  it("Tab fired while the last button is focused wraps focus to the first", () => {
    const { getByText } = render(<TrapHarness />);
    const first = getByText("first");
    const last = getByText("last");

    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: "Tab" });

    expect(document.activeElement).toBe(first);
  });

  it("Shift+Tab fired while the first button is focused wraps focus to the last", () => {
    const { getByText } = render(<TrapHarness />);
    const first = getByText("first");
    const last = getByText("last");

    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  it("restores focus to the previously focused trigger on unmount", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount, getByText } = render(<TrapHarness />);
    expect(document.activeElement).toBe(getByText("first"));

    unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  // Regression (BUG 7): if useFocusTrap were called AFTER a component's own
  // initial-focus effect, its effect would capture `previouslyFocused` only
  // after focus had already moved onto the inner field — so on unmount it
  // would restore focus to that (now-unmounted) field, dropping it to
  // <body> instead of the trigger. Calling useFocusTrap first (matching the
  // fixed call order in ItemModal/CustomerEditModal/CommandPalette) captures
  // the real trigger, so restore-to-trigger still works even though a later
  // effect moves focus inside the container on mount.
  it("restores focus to the trigger on unmount even when a later initial-focus effect moves focus inside the container", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount, getByText } = render(<TrapThenInitialFocusHarness />);
    // the later initial-focus effect moved focus onto the inner field
    expect(document.activeElement).toBe(getByText("first"));

    unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
