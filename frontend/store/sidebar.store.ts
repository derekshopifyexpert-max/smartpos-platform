import { create } from "zustand";

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  toggleMobile: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  mobileOpen: false,

  toggle: () =>
    set((state) => ({
      collapsed: !state.collapsed,
    })),

  toggleMobile: () =>
    set((state) => ({
      mobileOpen: !state.mobileOpen,
    })),

  setCollapsed: (collapsed) =>
    set({
      collapsed,
    }),

  setMobileOpen: (mobileOpen) =>
    set({ mobileOpen }),
}));
