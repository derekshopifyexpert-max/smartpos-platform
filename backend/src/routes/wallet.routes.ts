import { FastifyInstance } from "fastify";

import WalletService from "../services/wallet.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import WalletController from "../controllers/wallet.controller.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  createWalletSchema,
  walletIdSchema,
  amountSchema,
  transferSchema,
  merchantWalletsSchema
} from "../validators/wallet.validator.js";


export default async function walletRoutes(
  app: FastifyInstance
) {

  const service =
    new WalletService(app);

  const controller =
    new WalletController(service);

  app.post(
  "/wallets",
  {
    preHandler: [
      authMiddleware,
      validateBody(createWalletSchema)
    ]
  },
  controller.create
);

  app.get(
    "/wallets/:id",
    {
      preHandler: validateParams(walletIdSchema)
    },
    controller.get
  );

  app.post(
    "/wallets/:id/credit",
    {
      preHandler: [
        validateParams(walletIdSchema),
        validateBody(amountSchema)
      ]
    },
    controller.credit
  );

  app.post(
    "/wallets/:id/debit",
    {
      preHandler: [
        validateParams(walletIdSchema),
        validateBody(amountSchema)
      ]
    },
    controller.debit
  );

  app.post(
    "/wallets/transfer",
    {
      preHandler: validateBody(transferSchema)
    },
    controller.transferFunds
  );
  
  app.get(
    "/merchants/:merchantId/wallets",
    {
      preHandler: validateParams(merchantWalletsSchema)
    },
    controller.merchantWallets
  );

}