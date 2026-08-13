"use client";

import { useMutation } from "@tanstack/react-query";

import {
  checkoutPaymentIntent,
  type CheckoutPaymentIntentPayload,
} from "@/features/payment-intents/services/payment-intent.service";

export function useCheckoutPaymentIntent() {
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: CheckoutPaymentIntentPayload;
    }) => checkoutPaymentIntent(id, payload),
  });
}