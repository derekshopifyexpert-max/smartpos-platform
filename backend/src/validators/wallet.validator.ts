import { z } from "zod";

export const createWalletSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(
        2,
        "Wallet name must be at least 2 characters."
      )
      .max(
        100,
        "Wallet name must not exceed 100 characters."
      ),

    currency: z
      .string()
      .trim()
      .min(1, "Currency is required.")
      .max(
        20,
        "Currency must not exceed 20 characters."
      ),

    blockchain: z
      .string()
      .trim()
      .min(1, "Blockchain is required.")
      .max(
        50,
        "Blockchain must not exceed 50 characters."
      ),

    network: z
      .string()
      .trim()
      .min(1, "Network is required.")
      .max(
        50,
        "Network must not exceed 50 characters."
      ),

    asset: z
      .string()
      .trim()
      .min(1, "Asset is required.")
      .max(
        20,
        "Asset must not exceed 20 characters."
      ),

    type: z
      .string()
      .trim()
      .min(
        1,
        "Wallet type is required."
      )
      .optional(),

    address: z
      .string()
      .trim()
      .min(
        1,
        "Wallet address is required."
      )
      .max(
        200,
        "Wallet address is invalid."
      ),

    metadata: z
      .record(z.string(), z.unknown())
      .optional(),
  })
  .strict();

export const walletIdSchema = z.object({
  id: z
    .string()
    .trim()
    .min(
      1,
      "Wallet ID is required."
    ),
});

export const amountSchema = z.object({
  amount: z.coerce
    .number()
    .positive(
      "Amount must be greater than zero."
    ),
});

export const transferSchema = z
  .object({
    fromWalletId: z
      .string()
      .trim()
      .min(
        1,
        "Source wallet is required."
      ),

    toWalletId: z
      .string()
      .trim()
      .min(
        1,
        "Destination wallet is required."
      ),

    amount: z.coerce
      .number()
      .positive(
        "Amount must be greater than zero."
      ),
  })
  .strict();

export const merchantWalletsSchema =
  z.object({
    merchantId: z
      .string()
      .trim()
      .min(
        1,
        "Merchant ID is required."
      ),
  });

export type CreateWalletDto =
  z.infer<typeof createWalletSchema>;

export type WalletTransferDto =
  z.infer<typeof transferSchema>;

export type WalletAmountDto =
  z.infer<typeof amountSchema>;

export type MerchantWalletsDto =
  z.infer<typeof merchantWalletsSchema>;