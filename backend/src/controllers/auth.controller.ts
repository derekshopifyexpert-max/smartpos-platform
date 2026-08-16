import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import AuthService from "../services/auth.service.js";

import type {
  LoginRequest,
  RegisterRequest,
} from "../types/auth.types.js";

export default class AuthController {
  constructor(
    private readonly authService: AuthService
  ) {}

  register = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const body =
      request.body as RegisterRequest;

    const result =
      await this.authService.register({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        password: body.password,
        merchantId: body.merchantId,
      });

    return reply
      .status(201)
      .send({
        success: true,
        data: result,
      });
  };

  login = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const body =
      request.body as LoginRequest;

    const result =
      await this.authService.login(
        body.email,
        body.password
      );

    return reply.send({
      success: true,
      data: result,
    });
  };

  refresh = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const body =
      request.body as {
        refreshToken: string;
      };

    const result =
      await this.authService.refresh(
        body.refreshToken
      );

    return reply.send({
      success: true,
      data: result,
    });
  };

  logout = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const body =
      request.body as {
        refreshToken: string;
      };

    await this.authService.logout(
      body.refreshToken
    );

    return reply.send({
      success: true,
      data: {
        message: "Logged out successfully.",
      },
    });
  };

  me = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const user =
      request.user as {
        id?: string;
      };

    if (!user?.id) {
      return reply
        .status(401)
        .send({
          success: false,
          statusCode: 401,
          error: "Unauthorized",
          message:
            "Authentication required.",
        });
    }

    const profile =
      await this.authService.me(
        user.id
      );

    return reply.send({
      success: true,
      data: profile,
    });
  };
}