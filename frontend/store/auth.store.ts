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
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

/**
 * SSR-safe storage adapter.
 *
 * SmartPOS can render through Next.js on the server, where
 * window/localStorage does not exist. Zustand persist still
 * requires a valid StateStorage object, so we provide an
 * explicit adapter instead of returning Storage | undefined.
 */
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

      setAuth: (token, user) => {
        set({
          token,
          user,
        });
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
    }
  )
);