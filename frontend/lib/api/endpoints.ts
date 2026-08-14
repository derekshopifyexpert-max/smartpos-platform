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

  wallets: {
    list: (merchantId: string) => `/merchants/${merchantId}/wallets`,
    create: "/wallets",
    detail: (id: string) => `/wallets/${id}`,
  },

  transactions: {
    list: "/transactions",
    detail: (id: string) => `/transactions/${id}`,
  },

  paymentIntents: {
    list: "/payment-intents",
    detail: (id: string) => `/payment-intents/${id}`,
    checkout: (id: string) => `/payment-intents/${id}/checkout`,
    authorizations: (id: string) => `/payment-intents/${id}/authorizations`,
    chargeAuthorization: (id: string, authorizationId: string) =>
      `/payment-intents/${id}/authorizations/${authorizationId}/charge`,
  },

  paymentMethods: {
    list: "/payment-methods",
    detail: (id: string) => `/payment-methods/${id}`,
    charge: (id: string) => `/payment-methods/${id}/charge`,
  },
};