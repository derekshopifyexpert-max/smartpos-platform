export type CheckoutPaymentIntentPayload = {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

import type {
  PaymentIntent,
  PaymentIntentResponse,
} from "../types/payment-intent";

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
) {
  const response = await api.post(
    ENDPOINTS.paymentIntents.checkout(id),
    customer
  );

  return response.data.data;
}