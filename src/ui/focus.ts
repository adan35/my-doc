/**
 * Puts keyboard focus back after an overlay closes. When the element that had
 * focus is gone (it was inside the overlay, or focus was on the page body), focus
 * goes to the open document's editor, or else to the main content area, so it is
 * never lost.
 */
export function restoreFocus(previous: Element | null) {
  const target =
    previous instanceof HTMLElement && previous.isConnected && previous !== document.body
      ? previous
      : (document.querySelector<HTMLElement>('#main .cm-content') ??
        document.querySelector<HTMLElement>('#main'));
  target?.focus({ preventScroll: true });
}

/** Restores focus only if nothing else took it, e.g. after a palette command ran. */
export function restoreFocusIfLost(previous: Element | null) {
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (!active || active === document.body) restoreFocus(previous);
  });
}
