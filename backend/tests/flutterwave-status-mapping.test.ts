import { TransactionStatus } from "@prisma/client";

import {
  mapFlutterwaveStatusToTransactionStatus,
  normalizeFlutterwaveCardBrand,
} from "../src/services/flutterwave-webhook.service.js";

describe("Flutterwave status mapping", () => {
  it("maps successful provider states to the correct SmartPOS transaction status", () => {
    expect(mapFlutterwaveStatusToTransactionStatus("successful")).toBe(TransactionStatus.SETTLED);
    expect(mapFlutterwaveStatusToTransactionStatus("approved")).toBe(TransactionStatus.APPROVED);
    expect(mapFlutterwaveStatusToTransactionStatus("pending")).toBe(TransactionStatus.PENDING);
    expect(mapFlutterwaveStatusToTransactionStatus("failed")).toBe(TransactionStatus.FAILED);
    expect(mapFlutterwaveStatusToTransactionStatus("cancelled")).toBe(TransactionStatus.CANCELLED);
  });

  it("normalizes common Flutterwave card brands", () => {
    expect(normalizeFlutterwaveCardBrand("visa")).toBe("VISA");
    expect(normalizeFlutterwaveCardBrand("mastercard")).toBe("MASTERCARD");
    expect(normalizeFlutterwaveCardBrand("verve")).toBe("VERVE");
  });
});
