import { FastifyInstance } from "fastify";

import WalletService from "../services/wallet.service.js";
import WalletController from "../controllers/wallet.controller.js";

import {
  validateBody,
  validateParams,
} from "../middleware/validate.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

import {
  createWalletSchema,
  walletIdSchema,
  amountSchema,
  transferSchema,
  merchantWalletsSchema,
} from "../validators/wallet.validator.js";

export default async function walletRoutes(
  app: FastifyInstance
) {
  const service = new WalletService(app);

  const controller = new WalletController(service);

  /*
   * Wallets belong to an authenticated merchant account.
   *
   * The browser must never be trusted to supply an arbitrary
   * merchantId. The controller derives the merchant from
   * request.user.
   */
  app.post(
    "/wallets",
    {
      preHandler: [
        authMiddleware,
        validateBody(createWalletSchema),
      ],
    },
    controller.create
  );

  app.get(
    "/wallets/:id",
    {
      preHandler: [
        authMiddleware,
        validateParams(walletIdSchema),
      ],
    },
    controller.get
  );

  app.post(
    "/wallets/:id/credit",
    {
      preHandler: [
        authMiddleware,
        validateParams(walletIdSchema),
        validateBody(amountSchema),
      ],
    },
    controller.credit
  );

  app.post(
    "/wallets/:id/debit",
    {
      preHandler: [
        authMiddleware,
        validateParams(walletIdSchema),
        validateBody(amountSchema),
      ],
    },
    controller.debit
  );

  app.post(
    "/wallets/transfer",
    {
      preHandler: [
        authMiddleware,
        validateBody(transferSchema),
      ],
    },
    controller.transferFunds
  );

  /*
   * The merchantId parameter is retained for route compatibility.
   * The controller must NOT trust it. It uses the authenticated
   * user's merchantId instead.
   */
  app.get(
    "/merchants/:merchantId/wallets",
    {
      preHandler: [
        authMiddleware,
        validateParams(merchantWalletsSchema),
      ],
    },
    controller.merchantWallets
  );
}