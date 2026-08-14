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

        const storage = {
          getItem: (name: string) => {
            if (!isClient) return null;
            return window.localStorage.getItem(name);
          },
          setItem: (name: string, value: string) => {
            if (!isClient) return;
            window.localStorage.setItem(name, value);
          },
          removeItem: (name: string) => {
            if (!isClient) return;
            window.localStorage.removeItem(name);
          },
        } as Storage;

        return storage;
      },
    }
  )
);
