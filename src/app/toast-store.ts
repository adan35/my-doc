import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  detail?: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  show(t: Partial<Toast> & { message: string }): number;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show(t) {
    const toast: Toast = { tone: 'info', duration: t.action ? 7000 : 4000, ...t, id: nextId++ };
    // Only the newest undo-able toast stays: an old "Undo" must never act on a stale operation by surprise.
    set((s) => ({
      toasts: [...s.toasts.filter((x) => !(toast.action && x.action)).slice(-3), toast],
    }));
    return toast.id;
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = (t: Partial<Toast> & { message: string }) => useToasts.getState().show(t);

/** Shows a human-readable error, never a raw stack or exception name. */
export function toastError(message: string, err?: unknown, action?: Toast['action']) {
  if (err) console.error(message, err);
  const detail =
    err instanceof Error && err.name !== 'Error' && err.name !== 'TypeError'
      ? err.message
      : undefined;
  return toast({ message, detail, tone: 'error', action, duration: 8000 });
}
