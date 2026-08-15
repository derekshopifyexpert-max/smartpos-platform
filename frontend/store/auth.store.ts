import { create } from "zustand";
import {
  createJSONStorage,
  persist,
} from "zustand/middleware";

import type { User } from "@/types/auth";

interface AuthState {
  token: string | null;
  user: User | null;

  setAuth: (
    token: string,
    user: User
  ) => void;

  updateUser: (
    user: User
  ) => void;

  logout: () => void;
}

export const useAuthStore =
  create<AuthState>()(
    persist(
      (set) => ({
        token: null,
        user: null,

        setAuth: (
          token,
          user
        ) => {
          set({
            token,
            user: {
              ...user,
              merchantId:
                user.merchantId ??
                null,
            },
          });
        },

        updateUser: (
          user
        ) => {
          set({
            user: {
              ...user,
              merchantId:
                user.merchantId ??
                null,
            },
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

        storage:
          createJSONStorage(
            () => {
              if (
                typeof window ===
                "undefined"
              ) {
                return {
                  getItem: () =>
                    null,
                  setItem: () => {},
                  removeItem: () => {},
                };
              }

              return window.localStorage;
            }
          ),
      }
    )
  );