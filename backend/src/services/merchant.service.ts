import { FastifyInstance } from "fastify";

export default class MerchantService {

  constructor(
    private readonly app: FastifyInstance
  ) {}

  async create(data: any) {

    return this.app.prisma.$transaction(
      async (tx) => {

        const merchant =
          await tx.merchant.create({
            data: {
              name:
                data.businessName,

              businessType:
                data.businessType ??
                "GENERAL",

              email:
                data.email,

              phone:
                data.phone,

              website:
                data.website,

              country:
                data.country,

              state:
                data.state,

              city:
                data.city,

              addressLine1:
                data.address,

              postalCode:
                data.postalCode,

              currency:
                data.currency ??
                "USD"
            }
          });

        return {
          merchant
        };
      }
    );

  }

  async findById(id: string) {

    const merchant =
      await this.app.prisma.merchant.findUnique({

        where: {
          id
        },

        include: {
          users: true,
          terminals: true,
          wallets: true,
          transactions: true
        }

      });

    if (!merchant) {
      throw this.app.httpErrors.notFound(
        "Merchant not found."
      );
    }

    return merchant;

  }

  async list(
    page = 1,
    limit = 10
  ) {

    const skip =
      (page - 1) * limit;

    const [items, total] =
      await this.app.prisma.$transaction([
        this.app.prisma.merchant.findMany({

          skip,

          take: limit,

          orderBy: {
            createdAt: "desc"
          }

        }),

        this.app.prisma.merchant.count()
      ]);

    return {
      items,

      pagination: {
        page,
        limit,
        total,
        pages:
          Math.ceil(
            total / limit
          )
      }
    };

  }

  async update(
    id: string,
    data: any
  ) {

    await this.findById(id);

    return this.app.prisma.merchant.update({

      where: {
        id
      },

      data: {
        ...(data.businessName !== undefined && {
          name:
            data.businessName
        }),

        ...(data.businessType !== undefined && {
          businessType:
            data.businessType
        }),

        ...(data.email !== undefined && {
          email:
            data.email
        }),

        ...(data.phone !== undefined && {
          phone:
            data.phone
        }),

        ...(data.website !== undefined && {
          website:
            data.website
        }),

        ...(data.country !== undefined && {
          country:
            data.country
        }),

        ...(data.state !== undefined && {
          state:
            data.state
        }),

        ...(data.city !== undefined && {
          city:
            data.city
        }),

        ...(data.address !== undefined && {
          addressLine1:
            data.address
        }),

        ...(data.postalCode !== undefined && {
          postalCode:
            data.postalCode
        }),

        ...(data.currency !== undefined && {
          currency:
            data.currency
        })
      }

    });

  }

  async delete(id: string) {

    await this.findById(id);

    await this.app.prisma.merchant.delete({

      where: {
        id
      }

    });

    return {
      success: true
    };

  }

  async dashboard(
    merchantId: string
  ) {

    const merchant =
      await this.findById(
        merchantId
      );

    const [
      walletCount,
      transactionCount,
      settlementCount
    ] =
      await this.app.prisma.$transaction([

        this.app.prisma.wallet.count({
          where: {
            merchantId
          }
        }),

        this.app.prisma.transaction.count({
          where: {
            merchantId
          }
        }),

        this.app.prisma.settlement.count({
          where: {
            merchantId
          }
        })

      ]);

    return {
      merchant,

      statistics: {
        walletCount,
        transactionCount,
        settlementCount
      }
    };

  }

}