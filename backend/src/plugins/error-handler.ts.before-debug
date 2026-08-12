import fp from "fastify-plugin";
import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export default fp(async (app: FastifyInstance) => {
  app.setErrorHandler(
    (
      error: FastifyError & {
        statusCode?: number;
      },
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      request.log.error(error);

      const statusCode =
        typeof error.statusCode === "number" &&
        error.statusCode >= 400 &&
        error.statusCode < 600
          ? error.statusCode
          : 500;

      return reply.status(statusCode).send({
        success: false,
        statusCode,
        error:
          statusCode >= 500
            ? "Internal Server Error"
            : statusCode === 401
              ? "Unauthorized"
              : error.name || "Error",
        message:
          statusCode >= 500
            ? "Internal server error."
            : error.message,
      });
    }
  );
});
