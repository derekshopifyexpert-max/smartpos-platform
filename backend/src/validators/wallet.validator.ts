import { z } from "zod";

/**
 * SmartPOS wallet policy:
 *
 * SmartPOS does NOT generate wallets.
 * SmartPOS does NOT generate addresses.
 * SmartPOS does NOT generate private keys.
 * SmartPOS does NOT accept seed phrases or mnemonics.
 *
 * A wallet record is an existing merchant-owned public settlement
 * destination that SmartPOS stores after validating the supplied
 * address against the selected blockchain/network.
 */

const walletNameSchema = z
  .string()
  .trim()
  .min(2, "Wallet name must be at least 2 characters.")
  .max(100, "Wallet name must not exceed 100 characters.");

const currencySchema = z
  .string()
  .trim()
  .min(3, "Currency is required.")
  .max(10, "Currency must not exceed 10 characters.")
  .transform((value) => value.toUpperCase());

const blockchainSchema = z
  .string()
  .trim()
  .min(1, "Blockchain is required.")
  .max(50, "Blockchain is invalid.")
  .transform((value) => value.toUpperCase());

const networkSchema = z
  .string()
  .trim()
  .min(1, "Network is required.")
  .max(50, "Network is invalid.")
  .transform((value) => value.toUpperCase());

const assetSchema = z
  .string()
  .trim()
  .min(1, "Asset is required.")
  .max(20, "Asset is invalid.")
  .transform((value) => value.toUpperCase());

const publicWalletAddressSchema = z
  .string()
  .trim()
  .min(1, "Wallet address is required.")
  .max(
    200,
    "Wallet address is too long."
  )
  .refine(
    (value) => {
      /*
       * Reject obvious attempts to submit wallet secrets.
       *
       * This is intentionally only a defensive input check.
       * The backend must never accept, store or return these values.
       */
      const secretPattern =
        /^(0x)?[a-fA-F0-9]{64}$/;

      const secretWords =
        /\b(seed phrase|seedphrase|mnemonic|private key|privatekey|secret key|secretkey)\b/i;

      return (
        !secretPattern.test(value) &&
        !secretWords.test(value)
      );
    },
    {
      message:
        "Only an existing public wallet address can be saved. Private keys, seed phrases and other wallet credentials are not accepted.",
    }
  );

export const createWalletSchema = z
  .object({
    name: walletNameSchema,

    currency: currencySchema,

    blockchain: blockchainSchema,

    network: networkSchema,

    asset: assetSchema,

    /*
     * This is deliberately required.
     *
     * SmartPOS stores an address supplied by the merchant.
     * It never generates this value.
     */
    address: publicWalletAddressSchema,

    type: z
      .string()
      .trim()
      .min(
        1,
        "Wallet type is required when supplied."
      )
      .max(30, "Wallet type is invalid.")
      .optional(),

    metadata: z
      .record(z.unknown())
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.blockchain !== data.network) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["network"],
        message:
          "Blockchain and network must refer to the same network.",
      });
    }

    /*
     * SmartPOS currently has a real address-validation
     * implementation for the EVM networks already used by
     * the wallet flow.
     *
     * Other networks must not silently pass through as if
     * they were EVM networks.
     */
    const supportedEvmNetworks = new Set([
      "ETHEREUM",
      "BSC",
    ]);

    if (
      !supportedEvmNetworks.has(
        data.network
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["network"],
        message:
          `Wallet saving for ${data.network} requires a network-specific address validator and settlement capability. SmartPOS will not accept an address by shape alone.`,
      });
    }
  });

export const walletIdSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Wallet ID is required."),
});

export const amountSchema = z.object({
  amount: z.coerce
    .number()
    .finite(
      "Amount must be a valid number."
    )
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
      .finite(
        "Amount must be a valid number."
      )
      .positive(
        "Transfer amount must be greater than zero."
      ),
  })
  .refine(
    (data) =>
      data.fromWalletId !==
      data.toWalletId,
    {
      path: ["toWalletId"],
      message:
        "Source and destination wallets must be different.",
    }
  );

export const merchantWalletsSchema = z.object({
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