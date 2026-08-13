import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

import type {
  ChargeSavedAuthorizationResponse,
  CheckoutPaymentIntentResponse,
  CustomerPaymentMethod,
  CustomerPaymentMethodsResponse,
  PaymentIntent,
  PaymentIntentAuthorization,
  PaymentIntentAuthorizationsResponse,
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

export async function getPaymentIntentAuthorizations(
  id: string
): Promise<PaymentIntentAuthorization[]> {
  const response = await api.get<PaymentIntentAuthorizationsResponse>(
    ENDPOINTS.paymentIntents.authorizations(id)
  );

  return response.data.data.authorizations;
}

export async function chargeSavedAuthorization(
  id: string,
  authorizationId: string,
  payload: {
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<ChargeSavedAuthorizationResponse> {
  const response = await api.post<{
    success: boolean;
    data: ChargeSavedAuthorizationResponse;
  }>(
    ENDPOINTS.paymentIntents.chargeAuthorization(id, authorizationId),
    payload
  );

  return response.data.data;
}