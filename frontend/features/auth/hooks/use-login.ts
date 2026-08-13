"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { login } from "../services/auth.service";
import { useAuthStore } from "@/store/auth.store";

export function useLogin() {
  const router = useRouter();

  const setAuth = useAuthStore(
    (state) => state.setAuth
  );

  return useMutation({
    mutationFn: login,

    onSuccess(response) {
      setAuth(
        response.accessToken,
        response.user
      );

      toast.success("Login successful.");

      router.replace("/dashboard");
    },

    onError(error: unknown) {
      console.error("Login failed:", error);

      const responseData =
        typeof error === "object" &&
        error !== null &&
        "response" in error
          ? (
              error as {
                response?: {
                  data?: {
                    message?: string;
                  };
                };
              }
            ).response?.data
          : undefined;

      toast.error(
        responseData?.message ??
          "Unable to login."
      );
    },
  });
}