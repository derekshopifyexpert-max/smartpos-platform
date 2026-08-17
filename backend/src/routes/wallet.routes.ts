import type { FastifyInstance } from "fastify";

import WalletService from "../services/wallet.service.js";
import WalletController from "../controllers/wallet.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

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

  const authenticated = {
    preHandler: authMiddleware,
  };

  // Allow creating wallets without an authenticated merchant; controller will
  // Require authentication to create wallets; controller will fallback to an admin-owned merchant when needed.
  app.post("/wallets", {
    preHandler: [authMiddleware, validateBody(createWalletSchema)],
    handler: walletController.create,
  });

  // Public list of wallets (used by New Payment / Saved Wallets UI)
  app.get("/wallets", {
    handler: walletController.list,
  });

  app.get("/wallets/:id", {
    ...authenticated,
    preHandler: [
      authMiddleware,
      validateParams(walletIdSchema),
    ],
    handler: walletController.get,
  });

  app.delete("/wallets/:id", {
    ...authenticated,
    preHandler: [
      authMiddleware,
      validateParams(walletIdSchema),
    ],
    handler: walletController.delete,
  });

  app.post("/wallets/:id/credit", {
    ...authenticated,
    preHandler: [
      authMiddleware,
      validateParams(walletIdSchema),
      validateBody(amountSchema),
    ],
    handler: walletController.credit,
  });

  app.post("/wallets/:id/debit", {
    ...authenticated,
    preHandler: [
      authMiddleware,
      validateParams(walletIdSchema),
      validateBody(amountSchema),
    ],
    handler: walletController.debit,
  });

  app.post("/wallets/transfer", {
    ...authenticated,
    preHandler: [
      authMiddleware,
      validateBody(transferSchema),
    ],
    handler: walletController.transferFunds,
  });

  app.get("/merchants/:merchantId/wallets", {
    ...authenticated,
    preHandler: [
      authMiddleware,
      validateParams(merchantWalletsSchema),
    ],
    handler: walletController.merchantWallets,
  });
}