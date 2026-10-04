import { create } from 'zustand';
import { prefs } from './prefs';
import type { ViewMode } from './settings-store';

export type Overlay = 'palette' | 'quickopen' | null;
export type RightPanel = 'outline' | 'backlinks' | 'info';

interface UiState {
  sidebarOpen: boolean;
  /** Mobile/tablet drawer. */
  drawerOpen: boolean;
  rightPanelOpen: boolean;
  rightPanel: RightPanel;
  overlay: Overlay;
  focusMode: boolean;
  readingMode: boolean;
  /** Per-document view mode overrides. */
  viewModes: Record<string, ViewMode>;
  setSidebar(open: boolean): void;
  setDrawer(open: boolean): void;
  setRightPanel(open: boolean, panel?: RightPanel): void;
  setOverlay(o: Overlay): void;
  setFocusMode(on: boolean): void;
  setReadingMode(on: boolean): void;
  setViewMode(id: string, mode: ViewMode): void;
}

const KEY = 'mydoc:layout';
const saved = prefs.get<{ sidebarOpen?: boolean; rightPanelOpen?: boolean; rightPanel?: RightPanel }>(KEY, {});

const persist = () => {
  const { sidebarOpen, rightPanelOpen, rightPanel } = useUi.getState();
  prefs.set(KEY, { sidebarOpen, rightPanelOpen, rightPanel });
};

export const useUi = create<UiState>((set) => ({
  sidebarOpen: saved.sidebarOpen ?? true,
  drawerOpen: false,
  rightPanelOpen: saved.rightPanelOpen ?? true,
  rightPanel: saved.rightPanel ?? 'outline',
  overlay: null,
  focusMode: false,
  readingMode: false,
  viewModes: {},
  setSidebar(open) {
    set({ sidebarOpen: open });
    persist();
  },
  setDrawer(open) {
    set({ drawerOpen: open });
  },
  setRightPanel(open, panel) {
    set((s) => ({ rightPanelOpen: open, rightPanel: panel ?? s.rightPanel }));
    persist();
  },
  setOverlay(overlay) {
    set({ overlay });
  },
  setFocusMode(focusMode) {
    set({ focusMode, readingMode: false });
  },
  setReadingMode(readingMode) {
    set({ readingMode, focusMode: false });
  },
  setViewMode(id, mode) {
    set((s) => ({ viewModes: { ...s.viewModes, [id]: mode } }));
  },
}));
