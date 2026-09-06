import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Start Transaction
|--------------------------------------------------------------------------
*/

export const StartTransactionSchema = z.object({

  merchantId:
    z.string()
      .min(1),

  terminalId:
    z.string()
      .min(1)
      .optional(),

  customerId:
    z.string()
      .min(1)
      .optional(),

  walletId:
    z.string()
      .min(1)
      .optional(),

  paymentMethodId:
    z.string()
      .min(1)
      .optional(),

  amount:
    z.coerce
      .number()
      .positive(),

  currency:
    z.string()
      .min(1),

  paymentMethod:
    z.string()
      .min(1),

  type:
    z.string()
      .min(1),

  description:
    z.string()
      .max(1000)
      .optional(),

  metadata:
    z.record(z.string(), z.any())
      .optional(),

  idempotencyKey:
    z.string()
      .min(1)
      .max(255)
      .optional()

});


/*
|--------------------------------------------------------------------------
| Execute Transaction
|--------------------------------------------------------------------------
|
| The provider is selected by the backend.
| The client should not control providerId,
| endpoint, requestBody, or requestHeaders.
|
*/

export const ExecuteTransactionSchema = z.object({

  transactionId:
    z.string()
      .min(1),

  fromCurrency:
    z.string()
      .min(1),

  toCurrency:
    z.string()
      .min(1)

});


/*
|--------------------------------------------------------------------------
| Settlement Transaction
|--------------------------------------------------------------------------
*/

export const SettlementTransactionSchema = z.object({

  transactionId:
    z.string()
      .min(1),

  blockchain:
    z.string()
      .min(1),

  merchantWalletId:
    z.string()
      .min(1),

  destinationWalletId:
    z.string()
      .min(1),

  fromAddress:
    z.string()
      .min(1),

  toAddress:
    z.string()
      .min(1),

  currency:
    z.string()
      .min(1)

});


/*
|--------------------------------------------------------------------------
| Fail Transaction
|--------------------------------------------------------------------------
*/

export const FailTransactionSchema = z.object({

  transactionId:
    z.string()
      .min(1),

  reason:
    z.string()
      .min(1)
      .max(2000)

});


/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export const transactionIdSchema = z.object({
  id: z.string().min(1)
});

export const transactionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export const deleteTransactionsSchema = z.object({
  currentEmail: z.string().email(),
  currentPassword: z.string().min(8).max(100),
  ids: z.array(z.string().min(1)).max(1000).optional(),
  deleteAll: z.boolean().optional(),
});

export const transactionRetentionSchema = z.object({
  enabled: z.boolean(),
});

export type StartTransactionInput =
  z.infer<
    typeof StartTransactionSchema
  >;

export type ExecuteTransactionInput =
  z.infer<
    typeof ExecuteTransactionSchema
  >;

export type SettlementTransactionInput =
  z.infer<
    typeof SettlementTransactionSchema
  >;

export type FailTransactionInput =
  z.infer<
    typeof FailTransactionSchema
  >;
