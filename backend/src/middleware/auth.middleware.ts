import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (error: any) {
    request.log.warn(
      {
        error: {
          name: error?.name,
          code: error?.code,
          message: error?.message,
        },
      },
      "JWT authentication failed"
    );

    return reply.status(401).send({
      success: false,
      statusCode: 401,
      error: "Unauthorized",
      message: "Authentication required.",
    });
  }
}