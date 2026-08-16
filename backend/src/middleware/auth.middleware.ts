import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (error: unknown) {
    request.log.warn(
      {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : error,
      },
      "JWT authentication failed"
    );

    reply.code(401).send({
      success: false,
      statusCode: 401,
      error: "Unauthorized",
      message: "Authentication required.",
    });

    return;
  }
}