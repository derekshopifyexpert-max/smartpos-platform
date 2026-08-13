import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

import type {
  CheckoutPaymentIntentResponse,
  PaymentIntent,
  PaymentIntentResponse,
} from "../types/payment-intent";

export type CheckoutPaymentIntentPayload = {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export async function getPaymentIntents(
  page = 1,
  limit = 10
): Promise<PaymentIntentResponse["data"]> {
  const response = await api.get<PaymentIntentResponse>(
    ENDPOINTS.paymentIntents.list,
    {
      params: {
        page,
        limit,
      },
    }
  );

  return response.data.data;
}

export async function getPaymentIntent(
  id: string
): Promise<PaymentIntent> {
  const response = await api.get<{
    success: boolean;
    data: PaymentIntent;
  }>(
    ENDPOINTS.paymentIntents.detail(id)
  );

  return response.data.data;
}

export async function checkoutPaymentIntent(
  id: string,
  customer: CheckoutPaymentIntentPayload = {}
): Promise<CheckoutPaymentIntentResponse> {
  const response = await api.post<{
    success: boolean;
    data: CheckoutPaymentIntentResponse;
  }>(
    ENDPOINTS.paymentIntents.checkout(id),
    customer
  );

  return response.data.data;
}