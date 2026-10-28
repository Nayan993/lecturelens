import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export const focusablesIn = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest('[hidden]'));

/**
 * Shared modal behaviour for Dialog and Drawer while `open`:
 * moves focus inside, traps Tab/Shift+Tab, closes on Escape, locks page scroll,
 * and on close returns focus to whatever was focused before opening (the trigger).
 */
export function useModalBehavior(
  open: boolean,
  panelRef: RefObject<HTMLElement>,
  onClose: () => void,
  getInitialFocus?: (panel: HTMLElement) => HTMLElement | undefined,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const getInitialFocusRef = useRef(getInitialFocus);
  getInitialFocusRef.current = getInitialFocus;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    (getInitialFocusRef.current?.(panel) ?? focusablesIn(panel)[0] ?? panel).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusablesIn(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.contains(event.target)) {
        (focusablesIn(panel)[0] ?? panel).focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [open, panelRef]);
}
