import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth header on client only by reading the persisted zustand key.
api.interceptors.request.use((config) => {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("smartpos-auth");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // Support both shape: { state: { token } } and { token }
          const token = parsed?.state?.token ?? parsed?.token ?? parsed?.state?.accessToken ?? parsed?.accessToken ?? null;
          if (token) {
            config.headers = config.headers ?? {};
            (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
          }
        } catch (e) {
          // clear invalid persisted auth to avoid continual parse errors
          try {
            localStorage.removeItem("smartpos-auth");
          } catch (e) {
            // ignore
          }
        }
      }
    }
  } catch (e) {
    // defensive noop
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      if (typeof window !== "undefined" && error.response?.status === 401) {
        // Clear persisted auth to force re-login
        try {
          localStorage.removeItem("smartpos-auth");
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    return Promise.reject(error);
  }
);