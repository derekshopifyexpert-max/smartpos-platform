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

    detail: (
      id: string
    ) => `/merchants/${id}`,

    dashboard: (
      id: string
    ) => `/merchants/${id}/dashboard`,
  },

  wallets: {
    list: "/wallets",

    create: "/wallets",

    detail: (
      id: string
    ) => `/wallets/${id}`,
  },

  transactions: {
    list: "/transactions",

    detail: (
      id: string
    ) => `/transactions/${id}`,
  },

  paymentIntents: {
    list: "/payment-intents",

    detail: (
      id: string
    ) => `/payment-intents/${id}`,

    checkout: (
      id: string
    ) =>
      `/payment-intents/${id}/checkout`,

    authorizations: (
      id: string
    ) =>
      `/payment-intents/${id}/authorizations`,

    chargeAuthorization: (
      id: string,
      authorizationId: string
    ) =>
      `/payment-intents/${id}/authorizations/${authorizationId}/charge`,

    cryptoSettlement: (id: string) =>
      `/payment-intents/${id}/crypto-settlement`,
  },

  paymentMethods: {
    list: "/payment-methods",

    detail: (
      id: string
    ) => `/payment-methods/${id}`,

    charge: (
      id: string
    ) =>
      `/payment-methods/${id}/charge`,
  },

  exchange: {
    realQuote: "/exchange/real-quote",
    buy: "/exchange/buy",
    sell: "/exchange/sell",
    order: (orderId: string) => `/exchange/orders/${orderId}`,
    balance: (asset: string) => `/exchange/balance/${asset}`,
  },
} as const;