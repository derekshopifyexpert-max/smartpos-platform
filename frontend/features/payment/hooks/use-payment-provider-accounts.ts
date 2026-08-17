import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";

export interface PaymentProviderAccount {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  currency: string;
  status: "ACTIVE" | "NOT_CONFIGURED" | "DISABLED" | "SUSPENDED";
  configured: boolean;
  publicKey?: string;
  isDefault: boolean;
  createdAt: string;
}

/**
 * Fetch all available payment provider accounts
 * Safe metadata only - no secret keys exposed
 */
export function usePaymentProviderAccounts() {
  return useQuery<PaymentProviderAccount[]>({
    queryKey: ["payment-provider-accounts"],
    queryFn: async () => {
      const response = await apiClient.get("/payment-provider-accounts");
      return response.data?.data || [];
    },
  });
}

/**
 * Fetch accounts for a specific provider (e.g., "PAYSTACK")
 */
export function usePaymentProviderAccountsByProvider(provider: string) {
  return useQuery<PaymentProviderAccount[]>({
    queryKey: ["payment-provider-accounts", "by-provider", provider],
    queryFn: async () => {
      const response = await apiClient.get(
        `/payment-provider-accounts/by-provider/${provider}`
      );
      return response.data?.data || [];
    },
    enabled: !!provider,
  });
}

/**
 * Fetch a single account by ID
 */
export function usePaymentProviderAccount(id: string) {
  return useQuery<PaymentProviderAccount>({
    queryKey: ["payment-provider-accounts", id],
    queryFn: async () => {
      const response = await apiClient.get(`/payment-provider-accounts/${id}`);
      return response.data?.data;
    },
    enabled: !!id,
  });
}
