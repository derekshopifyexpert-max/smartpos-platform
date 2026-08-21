import { FastifyInstance } from "fastify";
import { PaymentStatus, Prisma } from "@prisma/client";

export default async function reconciliationRoutes(
  app: FastifyInstance
) {
  app.get(
    "/reconciliation/report",
    async (request, reply) => {
      const stale =
        await app.prisma.paymentIntent.findMany({
          where: {
            status: PaymentStatus.CAPTURED,
          },
          include: {
            transactions: true,
          },
        });

      const report: Array<Record<string, unknown>> = [];

      for (const paymentIntent of stale) {
        /*
         * The current Prisma schema does not expose
         * paymentIntentId directly on CryptoConversion.
         *
         * We therefore look for the conversion through
         * its transaction relationship/metadata instead
         * of querying a field that does not exist.
         */
        const conversions =
          await app.prisma.cryptoConversion.findMany({
            where: {
              metadata: {
                path: ["paymentIntentId"],
                equals: paymentIntent.id,
              },
            },
          });

        const conversion =
          conversions[0] ?? null;

        if (!conversion) {
          report.push({
            paymentIntentId:
              paymentIntent.id,
            issue: "no_conversion",
            amount: paymentIntent.amount,
            currency:
              paymentIntent.currency,
          });

          continue;
        }

        /*
         * blockchainTransactionId is not a Prisma field
         * on CryptoConversion in the current generated
         * client. Check metadata instead.
         */
        const metadata =
          conversion.metadata;

        let blockchainTransactionId:
          | string
          | undefined;

        if (
          metadata !== null &&
          typeof metadata === "object" &&
          !Array.isArray(metadata)
        ) {
          const metadataObject =
            metadata as Prisma.JsonObject;

          const value =
            metadataObject[
              "blockchainTransactionId"
            ];

          if (typeof value === "string") {
            blockchainTransactionId =
              value;
          }
        }

        const bc =
          blockchainTransactionId
            ? await app.prisma.blockchainTransaction.findUnique(
                {
                  where: {
                    id: blockchainTransactionId,
                  },
                }
              )
            : null;

        if (!bc) {
          report.push({
            paymentIntentId:
              paymentIntent.id,
            conversionId:
              conversion.id,
            issue: "no_blockchain_tx",
            ...(blockchainTransactionId
              ? {
                  blockchainTransactionId,
                }
              : {}),
          });
        }
      }

      return reply.send({
        success: true,
        count: report.length,
        data: report,
      });
    }
  );
}