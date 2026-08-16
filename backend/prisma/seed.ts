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

const ADMIN_EMAIL = "admin@smartpos.com";
const ADMIN_PASSWORD = "Admin@12345";
const MERCHANT_EMAIL = "merchant@smartpos.com";
const TERMINAL_SERIAL = "TERM-1001";
const PAYMENT_CLIENT_SECRET = "pi_demo_secret";
const TRANSACTION_REFERENCE = "TX-DEMO-001";

async function main() {
  console.log("Starting SmartPOS database seed...");

  const passwordHash = await bcrypt.hash(
    ADMIN_PASSWORD,
    12
  );

  /*
   * --------------------------------------------------------------------------
   * Merchant
   * --------------------------------------------------------------------------
   *
   * The single SmartPOS admin is attached to this merchant.
   *
   * This is important because the authenticated user's JWT will contain
   * merchantId, allowing wallet/payment operations to resolve the correct
   * merchant without the frontend inventing or supplying a merchant ID.
   */

  const merchant = await prisma.merchant.upsert({
    where: {
      email: MERCHANT_EMAIL,
    },
    update: {
      name: "SmartPOS Demo Merchant",
      businessType: "Retail",
      phone: "+2348000000001",
      currency: CurrencyType.USD,
      status: MerchantStatus.ACTIVE,
      isVerified: true,
      deletedAt: null,
    },
    create: {
      name: "SmartPOS Demo Merchant",
      businessType: "Retail",
      email: MERCHANT_EMAIL,
      phone: "+2348000000001",
      currency: CurrencyType.USD,
      status: MerchantStatus.ACTIVE,
      isVerified: true,
    },
  });

  console.log(
    `Merchant ready: ${merchant.name} (${merchant.id})`
  );

  /*
   * --------------------------------------------------------------------------
   * Single SmartPOS Admin User
   * --------------------------------------------------------------------------
   *
   * This is the ONLY expected application user.
   *
   * The user is explicitly attached to the merchant above.
   */

  const user = await prisma.user.upsert({
    where: {
      email: ADMIN_EMAIL,
    },
    update: {
      firstName: "Admin",
      lastName: "User",
      displayName: "SmartPOS Admin",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      isVerified: true,
      merchantId: merchant.id,
      deletedAt: null,
    },
    create: {
      email: ADMIN_EMAIL,
      firstName: "Admin",
      lastName: "User",
      displayName: "SmartPOS Admin",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      isVerified: true,
      merchantId: merchant.id,
    },
  });

  console.log(
    `Admin ready: ${user.email} (${user.id})`
  );

  console.log(
    `Admin merchantId: ${user.merchantId ?? "NONE"}`
  );

  /*
   * --------------------------------------------------------------------------
   * Terminal
   * --------------------------------------------------------------------------
   */

  const terminal = await prisma.terminal.upsert({
    where: {
      serialNumber: TERMINAL_SERIAL,
    },
    update: {
      merchantId: merchant.id,
      model: "PAX A920",
      manufacturer: "PAX",
      status: TerminalStatus.ONLINE,
    },
    create: {
      merchantId: merchant.id,
      serialNumber: TERMINAL_SERIAL,
      model: "PAX A920",
      manufacturer: "PAX",
      status: TerminalStatus.ONLINE,
    },
  });

  console.log(
    `Terminal ready: ${terminal.serialNumber}`
  );

  /*
   * --------------------------------------------------------------------------
   * Payment Intent
   * --------------------------------------------------------------------------
   */

  const paymentIntent =
    await prisma.paymentIntent.upsert({
      where: {
        clientSecret: PAYMENT_CLIENT_SECRET,
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
        clientSecret: PAYMENT_CLIENT_SECRET,
        status: PaymentStatus.PENDING,
        description: "Demo payment intent",
      },
    });

  console.log(
    `Payment intent ready: ${paymentIntent.id}`
  );

  /*
   * --------------------------------------------------------------------------
   * Transaction
   * --------------------------------------------------------------------------
   */

  const transaction =
    await prisma.transaction.upsert({
      where: {
        reference: TRANSACTION_REFERENCE,
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
        reference: TRANSACTION_REFERENCE,
        description: "Demo POS payment",
        status: TransactionStatus.SETTLED,
        settlementStatus: SettlementStatus.PENDING,
      },
    });

  console.log(
    `Transaction ready: ${transaction.reference}`
  );

  /*
   * --------------------------------------------------------------------------
   * Final verification
   * --------------------------------------------------------------------------
   */

  const verifiedAdmin =
    await prisma.user.findUnique({
      where: {
        email: ADMIN_EMAIL,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        isActive: true,
        isVerified: true,
        merchantId: true,
      },
    });

  if (!verifiedAdmin) {
    throw new Error(
      "Seed verification failed: admin user was not found."
    );
  }

  if (
    verifiedAdmin.email !== ADMIN_EMAIL
  ) {
    throw new Error(
      "Seed verification failed: unexpected admin email."
    );
  }

  if (
    verifiedAdmin.merchantId !== merchant.id
  ) {
    throw new Error(
      "Seed verification failed: admin is not attached to the seeded merchant."
    );
  }

  if (
    verifiedAdmin.role !== UserRole.SUPER_ADMIN
  ) {
    throw new Error(
      "Seed verification failed: admin does not have SUPER_ADMIN role."
    );
  }

  if (
    verifiedAdmin.status !== UserStatus.ACTIVE ||
    !verifiedAdmin.isActive ||
    !verifiedAdmin.isVerified
  ) {
    throw new Error(
      "Seed verification failed: admin account is not active and verified."
    );
  }

  console.log("");
  console.log("SmartPOS seed completed successfully.");
  console.log("----------------------------------------");
  console.log(`Admin email:    ${ADMIN_EMAIL}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
  console.log(`Admin user ID:  ${verifiedAdmin.id}`);
  console.log(`Merchant ID:    ${merchant.id}`);
  console.log(`Admin role:     ${verifiedAdmin.role}`);
  console.log(`Admin status:   ${verifiedAdmin.status}`);
  console.log("----------------------------------------");
}

main()
  .catch((error) => {
    console.error(
      "SmartPOS seed failed:",
      error
    );

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
