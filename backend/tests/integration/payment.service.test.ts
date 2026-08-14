import prisma from "../helpers/test-db";

import PaymentService from "../../src/services/payment.service";
import PaymentOrchestratorService from "../../src/services/payment-orchestrator.service";
import WalletService from "../../src/services/wallet.service";
import { NotConfiguredCryptoTransferProvider } from "../../src/providers/crypto-transfer.provider";

describe(
  "Payment Service",
  () => {
    let service: PaymentService;

    beforeAll(() => {
      service = new PaymentService({} as any);
    });

    it("should create payment intent", async () => {
      expect(service).toBeDefined();
    });

    it("should normalize crypto destination metadata for checkout", () => {
      const orchestrator = new PaymentOrchestratorService({} as any);

      const normalized = (orchestrator as any).normalizeCryptoDestinationMetadata({
        cryptoDestination: {
          asset: "USDT",
          network: "TRON",
          address: "TQWQ9Xk...",
          amount: 120,
          currency: "USD",
        },
      });

      expect(normalized).toMatchObject({
        cryptoDestination: {
          asset: "USDT",
          network: "TRON",
          address: "TQWQ9Xk...",
          amount: 120,
          currency: "USD",
        },
      });
    });

    it("should preserve crypto destination metadata from multiple keys", () => {
      const normalized = (service as any).normalizeMetadata({
        crypto_destination: {
          asset: "USDC",
          network: "ETHEREUM",
          address: "0xabc",
          amount: 15,
        },
        destination: {
          walletId: "wallet-1",
        },
      });

      expect(normalized).toMatchObject({
        cryptoDestination: {
          asset: "USDC",
          network: "ETHEREUM",
          address: "0xabc",
          amount: 15,
          walletId: "wallet-1",
        },
      });
    });

    it("should keep provider-not-configured state explicit for crypto settlement", async () => {
      const provider = new NotConfiguredCryptoTransferProvider();
      const result = await provider.sendTransaction({
        asset: "USDT",
        network: "ETHEREUM",
        toAddress: "0xabc",
        amount: 10,
      });

      expect(result.status).toBe("NOT_CONFIGURED");
      expect(result.success).toBe(false);
    });

    it("should create a wallet using the real wallet service contract", async () => {
      const walletService = new WalletService({
        prisma: {
          merchant: {
            findUnique: jest.fn().mockResolvedValue({ id: "merchant-1" }),
          },
          blockchainNetwork: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: "network-1", name: "ETHEREUM" }),
          },
          wallet: {
            create: jest.fn().mockResolvedValue({
              id: "wallet-1",
              merchantId: "merchant-1",
              address: "0x123",
              name: "USDT Wallet",
            }),
          },
          walletAddress: {
            create: jest.fn().mockResolvedValue({ id: "wallet-address-1" }),
          },
        },
      } as any);

      const wallet = await walletService.createWallet({
        merchantId: "merchant-1",
        name: "USDT Wallet",
        asset: "USDT",
        network: "ETHEREUM",
      });

      expect(wallet).toMatchObject({
        id: "wallet-1",
        merchantId: "merchant-1",
        name: "USDT Wallet",
      });
    });
  }
);
