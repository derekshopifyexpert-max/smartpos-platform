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
  const walletService = new WalletService(app);

  const walletController =
    new WalletController(walletService);

  app.post("/wallets", {
    preHandler: validateBody(
      createWalletSchema
    ),
    handler: walletController.create,
  });

  app.get("/wallets/:id", {
    preHandler: validateParams(
      walletIdSchema
    ),
    handler: walletController.get,
  });

  app.delete("/wallets/:id", {
    preHandler: validateParams(
      walletIdSchema
    ),
    handler: walletController.delete,
  });

  app.post("/wallets/:id/credit", {
    preHandler: [
      validateParams(walletIdSchema),
      validateBody(amountSchema),
    ],
    handler: walletController.credit,
  });

  app.post("/wallets/:id/debit", {
    preHandler: [
      validateParams(walletIdSchema),
      validateBody(amountSchema),
    ],
    handler: walletController.debit,
  });

  app.post("/wallets/transfer", {
    preHandler: validateBody(
      transferSchema
    ),
    handler:
      walletController.transferFunds,
  });

  app.get(
    "/merchants/:merchantId/wallets",
    {
      preHandler: validateParams(
        merchantWalletsSchema
      ),
      handler:
        walletController.merchantWallets,
    }
  );
}