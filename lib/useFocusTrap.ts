"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Traps Tab focus inside `containerRef` while mounted, and restores focus to
 * whatever was previously focused when it unmounts. Does not manage Escape or
 * body-scroll locking — callers keep their own effects for that.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (container) {
      const active = document.activeElement;
      const focusIsInside = active instanceof HTMLElement && container.contains(active);
      if (!focusIsInside) {
        getFocusable(container)[0]?.focus();
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !container) return;

      const focusable = getFocusable(container);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const focusIsInside = active instanceof HTMLElement && container.contains(active);

      if (event.shiftKey) {
        if (!focusIsInside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!focusIsInside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [containerRef]);
}
