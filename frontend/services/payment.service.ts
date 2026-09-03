import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

import type {
  PaymentIntentListResponse,
  PaymentIntentResponse,
} from "@/types/payment";

export interface CreatePaymentIntentPayload {
  amount: number;
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface CreatePaymentIntentResponse {
  success: boolean;
  message: string;
  data: PaymentIntentResponse;
}

export async function createPaymentIntent(
  payload: CreatePaymentIntentPayload
): Promise<PaymentIntentResponse> {
  const response =
    await api.post<CreatePaymentIntentResponse>(
      ENDPOINTS.paymentIntents.list,
      payload
    );

  return response.data.data;
}

export async function getPaymentIntents() {
  const response =
    await api.get<PaymentIntentListResponse>(
      ENDPOINTS.paymentIntents.list
    );

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return response.data.data;
}