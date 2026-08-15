import { z } from "zod";

export const createWalletSchema =
  z.object({
    merchantId:
      z.string().min(1),

    name:
      z.string()
        .trim()
        .min(2)
        .max(100),

    currency:
      z.string()
        .trim()
        .min(3)
        .max(10),

    blockchain:
      z.string()
        .trim()
        .min(1),

    network:
      z.string()
        .trim()
        .min(1),

    asset:
      z.string()
        .trim()
        .min(1),

    /*
     * SmartPOS never generates this value.
     * The merchant supplies an existing
     * public settlement address.
     */
    address:
      z.string()
        .trim()
        .min(1),

    type:
      z.string()
        .trim()
        .min(1)
        .optional(),

    metadata:
      z.record(
        z.string(),
        z.unknown()
      ).optional(),
  });

export const walletIdSchema =
  z.object({
    id:
      z.string().min(1),
  });

export const amountSchema =
  z.object({
    amount:
      z.coerce.number().positive(),
  });

export const transferSchema =
  z.object({
    fromWalletId:
      z.string().min(1),

    toWalletId:
      z.string().min(1),

    amount:
      z.coerce.number().positive(),
  });

export const merchantWalletsSchema =
  z.object({
    merchantId:
      z.string().min(1),
  });

export type CreateWalletDto =
  z.infer<
    typeof createWalletSchema
  >;

export type WalletTransferDto =
  z.infer<
    typeof transferSchema
  >;