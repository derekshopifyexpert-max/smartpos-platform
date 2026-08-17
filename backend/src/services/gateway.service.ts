import { Prisma } from "@prisma/client";
import { FastifyInstance } from "fastify";

export default class GatewayService {

  constructor(
    private readonly app: FastifyInstance
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Payment Provider
  |--------------------------------------------------------------------------
  */

  async getProvider(
    providerId: string
  ) {
    return this.app.prisma.paymentProvider.findUnique({
      where: {
        id: providerId
      }
    });
  }

  async activeProviders() {
    return this.app.prisma.paymentProvider.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async createProvider(data: {
    name: string;
    displayName: string;
    baseUrl?: string;
    priority?: number;
  }) {
    return this.app.prisma.paymentProvider.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        baseUrl: data.baseUrl,
        priority: data.priority ?? 0
      }
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Gateway Request
  |--------------------------------------------------------------------------
  */

  async createGatewayRequest(data: {
    providerId: string;
    transactionId?: string;
    endpoint: string;
    method: string;
    requestBody: Prisma.JsonValue;
    requestHeaders: Prisma.JsonValue;
  }) {

    /*
     * A transaction can have only one GatewayRequest because
     * transactionId is unique in the Prisma schema.
     *
     * Reuse the existing request when checkout is retried.
     */

    if (data.transactionId) {
      const existing =
        await this.app.prisma.gatewayRequest.findUnique({
          where: {
            transactionId: data.transactionId
          }
        });

      if (existing) {
        return existing;
      }
    }

    return this.app.prisma.gatewayRequest.create({
      data: {
        providerId: data.providerId,
        transactionId: data.transactionId,
        endpoint: data.endpoint,
        method: data.method,
        requestBody:
          data.requestBody ?? Prisma.JsonNull,
        requestHeaders:
          data.requestHeaders ?? Prisma.JsonNull
      }
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Gateway Response
  |--------------------------------------------------------------------------
  */

  async createGatewayResponse(data: {
    gatewayRequestId: string;
    statusCode: number;
    responseBody: Prisma.JsonValue;
    responseHeaders: Prisma.JsonValue;
    error?: string;
    responseTime?: number;
  }) {

    /*
     * GatewayResponse.gatewayRequestId is also unique.
     * Reuse the existing response on a repeated lifecycle operation.
     */

    const existing =
      await this.app.prisma.gatewayResponse.findUnique({
        where: {
          gatewayRequestId:
            data.gatewayRequestId
        }
      });

    if (existing) {
      return existing;
    }

    return this.app.prisma.gatewayResponse.create({
      data: {
        gatewayRequestId:
          data.gatewayRequestId,

        statusCode:
          data.statusCode,

        responseBody:
          data.responseBody ?? Prisma.JsonNull,

        responseHeaders:
          data.responseHeaders ?? Prisma.JsonNull,

        error:
          data.error,

        responseTime:
          data.responseTime
      }
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Lookup
  |--------------------------------------------------------------------------
  */

  async getGatewayRequest(
    id: string
  ) {
    return this.app.prisma.gatewayRequest.findUnique({
      where: {
        id
      },
      include: {
        provider: true,
        response: true,
        transaction: true
      }
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Provider Statistics
  |--------------------------------------------------------------------------
  */

  async providerStatistics(
    providerId: string
  ) {

    const [
      totalRequests,
      successfulRequests,
      failedRequests
    ] = await Promise.all([

      this.app.prisma.gatewayRequest.count({
        where: {
          providerId
        }
      }),

      this.app.prisma.gatewayResponse.count({
        where: {
          gatewayRequest: {
            providerId
          },
          statusCode: {
            gte: 200,
            lt: 400
          }
        }
      }),

      this.app.prisma.gatewayResponse.count({
        where: {
          gatewayRequest: {
            providerId
          },
          statusCode: {
            gte: 400
          }
        }
      })

    ]);

    return {
      providerId,
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate:
        totalRequests > 0
          ? Number(
              (
                successfulRequests /
                totalRequests *
                100
              ).toFixed(2)
            )
          : 0
    };
  }

  async checkPaystackChannels() {
    // Run lightweight initialize calls for common currencies to verify account channels
    const dotenv = await import('dotenv');
    dotenv.config({ path: './.env' });

    const axios = (await import('axios')).default;

    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret) {
      throw new Error('PAYSTACK_SECRET_KEY not configured in environment.');
    }

    const client = axios.create({
      baseURL: 'https://api.paystack.co',
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      }
    });

    const currencies = ['NGN', 'USD'];

    const results: Record<string, unknown> = {};

    for (const cur of currencies) {
      try {
        const resp = await client.post('/transaction/initialize', {
          amount: '100',
          currency: cur,
          reference: `SMRTCHK-${cur}-${Date.now()}`,
          customerEmail: 'admin@smartpos.com',
          channels: ['card']
        });

        results[cur] = {
          ok: true,
          status: resp.status,
          data: resp.data
        };
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyErr = err as any;

        results[cur] = {
          ok: false,
          message: anyErr.message,
          status: anyErr.response?.status ?? null,
          data: anyErr.response?.data ?? null
        };
      }
    }

    return results;
  }

}
