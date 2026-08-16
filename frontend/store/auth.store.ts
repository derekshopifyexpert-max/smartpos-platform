import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

import type { User } from "@/types/auth";

interface AuthState {
  token: string | null;
  user: User | null;
  hydrated: boolean;

  setAuth: (token: string, user: User) => void;
  setHydrated: (hydrated: boolean) => void;
  logout: () => void;
}

const authStorage: StateStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(name);
  },

  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(name, value);
  },

  removeItem: (name: string) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,

      setAuth: (token, user) => {
        set({
          token,
          user,
        });
      },

      setHydrated: (hydrated) => {
        set({ hydrated });
      },

      logout: () => {
        set({
          token: null,
          user: null,
        });
      },
    }),
    {
      name: "smartpos-auth",

      storage: createJSONStorage(
        () => authStorage
      ),

      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),

      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);