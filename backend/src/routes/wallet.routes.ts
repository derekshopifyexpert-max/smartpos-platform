import type { FastifyInstance } from "fastify";

import WalletService from "../services/wallet.service.js";
import WalletController from "../controllers/wallet.controller.js";

import {
  validateBody,
  validateParams,
} from "../middleware/validate.js";

import {
  createWalletSchema,
  walletIdSchema,
  amountSchema,
  transferSchema,
  merchantWalletsSchema,
} from "../validators/wallet.validator.js";

export default async function walletRoutes(
  app: FastifyInstance
): Promise<void> {
  const walletService =
    new WalletService(app);

  const walletController =
    new WalletController(
      walletService
    );

  /*
   * Create a merchant settlement wallet.
   *
   * SmartPOS does not generate the wallet address.
   * The merchant must provide an existing public
   * settlement address.
   */
  app.post("/wallets", {
    preHandler: validateBody(
      createWalletSchema
    ),
    handler:
      walletController.create,
  });

  /*
   * Get a single wallet.
   */
  app.get("/wallets/:id", {
    preHandler: validateParams(
      walletIdSchema
    ),
    handler:
      walletController.get,
  });

  /*
   * Credit an internal SmartPOS wallet balance.
   */
  app.post(
    "/wallets/:id/credit",
    {
      preHandler: [
        validateParams(
          walletIdSchema
        ),
        validateBody(
          amountSchema
        ),
      ],
      handler:
        walletController.credit,
    }
  );

  /*
   * Debit an internal SmartPOS wallet balance.
   */
  app.post(
    "/wallets/:id/debit",
    {
      preHandler: [
        validateParams(
          walletIdSchema
        ),
        validateBody(
          amountSchema
        ),
      ],
      handler:
        walletController.debit,
    }
  );

  /*
   * Transfer funds between internal wallet
   * balance records.
   */
  app.post(
    "/wallets/transfer",
    {
      preHandler:
        validateBody(
          transferSchema
        ),
      handler:
        walletController.transferFunds,
    }
  );

  /*
   * Get all saved wallets belonging to a merchant.
   */
  app.get(
    "/merchants/:merchantId/wallets",
    {
      preHandler:
        validateParams(
          merchantWalletsSchema
        ),
      handler:
        walletController.merchantWallets,
    }
  );
}
