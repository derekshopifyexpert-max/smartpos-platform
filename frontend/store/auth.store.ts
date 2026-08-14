import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/types/auth";

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      setAuth: (token, user) => {
        set({ token, user });
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
      getStorage: () => {
        const isClient = typeof window !== "undefined";

        // Provide a safe storage shim for SSR and a normal wrapper for client
        if (!isClient) {
          return {
            getItem: (_name: string) => null,
            setItem: (_name: string, _value: string) => undefined,
            removeItem: (_name: string) => undefined,
          } as Storage;
        }

        return window.localStorage;
      },
    }
  )
);
