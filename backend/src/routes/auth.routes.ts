import { FastifyInstance } from "fastify";

import AuthService from "../services/auth.service.js";
import AuthController from "../controllers/auth.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.js";

import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
} from "../validators/auth.validator.js";

export default async function authRoutes(
  app: FastifyInstance
) {
  const service = new AuthService(app);
  const controller = new AuthController(service);

  app.post(
    "/auth/register",
    {
      preHandler: validateBody(
        registerSchema
      ),
    },
    controller.register
  );

  app.post(
    "/auth/login",
    {
      preHandler: validateBody(
        loginSchema
      ),
    },
    controller.login
  );

  app.post(
    "/auth/refresh",
    {
      preHandler: validateBody(
        refreshTokenSchema
      ),
    },
    controller.refresh
  );

  app.post(
    "/auth/logout",
    {
      preHandler: validateBody(
        refreshTokenSchema
      ),
    },
    controller.logout
  );

  app.get(
    "/auth/me",
    {
      preHandler: [
        authMiddleware,
      ],
    },
    controller.me
  );
}