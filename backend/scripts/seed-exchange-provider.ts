import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const provider = await prisma.exchangeProvider.upsert({
    where: { name: "example-http-provider" },
    update: {
      isActive: true,
      baseUrl: "https://api.example-crypto-provider.test/",
      apiKey: process.env.EXCHANGE_PROVIDER_API_KEY ?? "",
      apiSecret: process.env.EXCHANGE_PROVIDER_API_SECRET ?? "",
      metadata: {
          endpoints: {
            validateAddress: "/v1/address/validate",
            sendTransaction: "/v1/transactions/send",
            getTransaction: "/v1/transactions/{txHash}",
            getConfirmations: "/v1/transactions/{txHash}/confirmations",
            quote: "/v1/quotes",
            execute: "/v1/execute",
            status: "/v1/status/{txId}"
          },
          authHeader: "Authorization",
          authScheme: "Bearer",
      },
    },
    create: {
      name: "example-http-provider",
      isActive: true,
      baseUrl: "https://api.example-crypto-provider.test/",
      apiKey: process.env.EXCHANGE_PROVIDER_API_KEY ?? "",
      apiSecret: process.env.EXCHANGE_PROVIDER_API_SECRET ?? "",
      metadata: {
          endpoints: {
            validateAddress: "/v1/address/validate",
            sendTransaction: "/v1/transactions/send",
            getTransaction: "/v1/transactions/{txHash}",
            getConfirmations: "/v1/transactions/{txHash}/confirmations",
            quote: "/v1/quotes",
            execute: "/v1/execute",
            status: "/v1/status/{txId}"
          },
          authHeader: "Authorization",
          authScheme: "Bearer",
      },
    },
  });

  console.log("Upserted ExchangeProvider:", provider.id, provider.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
