import { FastifyInstance } from "fastify";

export default async function errorHandler(
  app: FastifyInstance
) {
  app.setErrorHandler(
    async (error: any, request, reply) => {

      request.log.error(error);

      const statusCode =
        error.statusCode && error.statusCode >= 400
          ? error.statusCode
          : 500;

      return reply.code(statusCode).send({
        success: false,
        statusCode,
        error:
          error.name ||
          "Internal Server Error",
        message:
          error.message ||
          "Internal server error.",
        ...(process.env.NODE_ENV !== "production"
          ? {
              details: error.meta ?? undefined,
              code: error.code ?? undefined,
              stack: error.stack ?? undefined
            }
          : {})
      });

    }
  );
}
