import {
  PrismaClient,
  UserRole,
  UserStatus,
  MerchantStatus,
  TerminalStatus,
  PaymentStatus,
  TransactionStatus,
  SettlementStatus,
  CurrencyType,
} from "@prisma/client";

import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(
    "Admin@12345",
    10
  );

  /*
  |--------------------------------------------------------------------------
  | Admin User
  |--------------------------------------------------------------------------
  */

  const user = await prisma.user.upsert({
    where: {
      email: "admin@smartpos.com",
    },
    update: {
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      isVerified: true,
    },
    create: {
      email: "admin@smartpos.com",
      firstName: "Admin",
      lastName: "User",
      displayName: "SmartPOS Admin",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      isVerified: true,
    },
  });

  console.log("Created/updated user:", user.email);

  /*
  |--------------------------------------------------------------------------
  | Merchant
  |--------------------------------------------------------------------------
  */

  const merchant = await prisma.merchant.upsert({
    where: {
      email: "merchant@smartpos.com",
    },
    update: {
      name: "Demo Merchant",
      businessType: "Retail",
      phone: "+2348000000001",
      currency: CurrencyType.USD,
      status: MerchantStatus.ACTIVE,
      isVerified: true,
    },
    create: {
      name: "Demo Merchant",
      businessType: "Retail",
      email: "merchant@smartpos.com",
      phone: "+2348000000001",
      currency: CurrencyType.USD,
      status: MerchantStatus.ACTIVE,
      isVerified: true,
    },
  });

  console.log(
    "Created/updated merchant:",
    merchant.name
  );

  /*
  |--------------------------------------------------------------------------
  | Terminal
  |--------------------------------------------------------------------------
  */

  const terminal = await prisma.terminal.upsert({
    where: {
      serialNumber: "TERM-1001",
    },
    update: {
      merchantId: merchant.id,
      model: "PAX A920",
      manufacturer: "PAX",
      status: TerminalStatus.ONLINE,
    },
    create: {
      merchantId: merchant.id,
      serialNumber: "TERM-1001",
      model: "PAX A920",
      manufacturer: "PAX",
      status: TerminalStatus.ONLINE,
    },
  });

  console.log(
    "Created/updated terminal:",
    terminal.serialNumber
  );

  /*
  |--------------------------------------------------------------------------
  | Payment Intent
  |--------------------------------------------------------------------------
  */

  const paymentIntent =
    await prisma.paymentIntent.upsert({
      where: {
        clientSecret: "pi_demo_secret",
      },
      update: {
        merchantId: merchant.id,
        amount: 2500,
        currency: CurrencyType.USD,
        status: PaymentStatus.PENDING,
        description: "Demo payment intent",
      },
      create: {
        merchantId: merchant.id,
        amount: 2500,
        currency: CurrencyType.USD,
        clientSecret: "pi_demo_secret",
        status: PaymentStatus.PENDING,
        description: "Demo payment intent",
      },
    });

  console.log(
    "Created/updated payment intent:",
    paymentIntent.id
  );

  /*
  |--------------------------------------------------------------------------
  | Transaction
  |--------------------------------------------------------------------------
  */

  const transaction =
    await prisma.transaction.upsert({
      where: {
        reference: "TX-DEMO-001",
      },
      update: {
        merchantId: merchant.id,
        terminalId: terminal.id,
        paymentIntentId: paymentIntent.id,
        amount: 2500,
        currency: CurrencyType.USD,
        paymentMethod: "CARD",
        type: "PURCHASE",
        description: "Demo POS payment",
        status: TransactionStatus.SETTLED,
        settlementStatus: SettlementStatus.PENDING,
      },
      create: {
        merchantId: merchant.id,
        terminalId: terminal.id,
        paymentIntentId: paymentIntent.id,
        amount: 2500,
        currency: CurrencyType.USD,
        paymentMethod: "CARD",
        type: "PURCHASE",
        reference: "TX-DEMO-001",
        description: "Demo POS payment",
        status: TransactionStatus.SETTLED,
        settlementStatus: SettlementStatus.PENDING,
      },
    });

  console.log(
    "Created/updated transaction:",
    transaction.reference
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
