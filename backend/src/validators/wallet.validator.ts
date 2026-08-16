import { z } from "zod";

const nonEmptyString = (
  message: string
) =>
  z
    .string()
    .trim()
    .min(1, message);

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
      .min(
        2,
        "Wallet currency is required."
      )
      .max(
        20,
        "Wallet currency must not exceed 20 characters."
      ),

    blockchain: nonEmptyString(
      "Blockchain is required."
    ),

    network: nonEmptyString(
      "Network is required."
    ),

    asset: nonEmptyString(
      "Asset is required."
    ),

    type: z
      .string()
      .trim()
      .min(1)
      .optional(),

    /*
     * This is an existing merchant-controlled
     * public settlement address.
     *
     * SmartPOS never generates this value.
     */
    address: z
      .string()
      .trim()
      .min(
        1,
        "Existing public wallet address is required."
      )
      .max(
        200,
        "Wallet address is too long."
      ),

    metadata: z
      .record(z.unknown())
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
    .number({
      message: "Amount must be a valid number.",
    })
    .finite(
      "Amount must be a finite number."
    )
    .positive(
      "Amount must be greater than zero."
    ),
});

export const transferSchema = z.object({
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
    .number({
      message: "Amount must be a valid number.",
    })
    .finite(
      "Amount must be a finite number."
    )
    .positive(
      "Transfer amount must be greater than zero."
    ),
});

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
  z.infer<
    typeof createWalletSchema
  >;

export type WalletTransferDto =
  z.infer<
    typeof transferSchema
  >;

export type WalletAmountDto =
  z.infer<
    typeof amountSchema
  >;

export type MerchantWalletsDto =
  z.infer<
    typeof merchantWalletsSchema
  >;