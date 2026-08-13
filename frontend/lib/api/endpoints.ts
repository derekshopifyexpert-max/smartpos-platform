export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    me: "/auth/me",
    logout: "/auth/logout",
  },

  dashboard: {
    metrics: "/metrics",
  },

  merchants: {
    list: "/merchants",
    detail: (id: string) => `/merchants/${id}`,
    dashboard: (id: string) => `/merchants/${id}/dashboard`,
  },

  transactions: {
    list: "/transactions",
    detail: (id: string) => `/transactions/${id}`,
  },

  paymentIntents: {
  list: "/payment-intents",
  detail: (id: string) => `/payment-intents/${id}`,
  checkout: (id: string) => `/payment-intents/${id}/checkout`,
},
};