import { z } from "zod";

export const CryptoDestinationSchema = z.object({
  asset: z.string().min(1).optional(),
  network: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  walletId: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  currency: z.string().min(3).max(10).optional(),
  reference: z.string().min(1).optional(),
}).passthrough();

export const CreatePaymentIntentSchema = z.object({

  merchantId:

    z.string().min(1),

  customerId:

    z.string().optional(),

  paymentMethodId:

    z.string().optional(),

  amount:

    z.coerce.number().positive(),

  currency:

    z.string().min(3).max(10),

  description:

    z.string().optional(),

  metadata:

    z.object({
      cryptoDestination: CryptoDestinationSchema.optional(),
      crypto_destination: CryptoDestinationSchema.optional(),
      destination: CryptoDestinationSchema.optional(),
    }).passthrough().optional(),

});

export const CreatePaymentAttemptSchema = z.object({

  paymentIntentId:

    z.string(),

  transactionId:

    z.string().optional(),

  amount:

    z.coerce.number().positive(),

  currency:

    z.string()

});

export type CreatePaymentIntentInput =
  z.infer<typeof CreatePaymentIntentSchema>;

export type CreatePaymentAttemptInput =
  z.infer<typeof CreatePaymentAttemptSchema>;
