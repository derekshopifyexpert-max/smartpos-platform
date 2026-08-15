import axios from "axios";

import { useAuthStore } from "@/store/auth.store";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,

  headers: {
    "Content-Type":
      "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token =
      useAuthStore.getState().token;

    if (token) {
      config.headers =
        config.headers ??
        {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  }
);

api.interceptors.response.use(
  (response) =>
    response,

  async (error) => {
    if (
      error?.response?.status ===
      401
    ) {
      /*
       * Do not perform a hard redirect here.
       * Dashboard components can decide how
       * to handle an expired session.
       */
      useAuthStore
        .getState()
        .logout();
    }

    return Promise.reject(
      error
    );
  }
);