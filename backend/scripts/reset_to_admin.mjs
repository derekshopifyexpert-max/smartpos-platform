import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@smartpos.com';
  const adminPassword = 'Admin@12345';

  console.log('Starting reset: removing non-admin users, merchants, wallets, and transactions.');

  try {
    // Remove transactions first (they reference merchants/wallets)
    console.log('Deleting transactions...');
    await prisma.transaction.deleteMany({});

    // Remove wallet-related records
    console.log('Deleting wallet addresses...');
    await prisma.walletAddress.deleteMany({});
    console.log('Deleting wallet audits...');
    await prisma.walletAudit.deleteMany({});
    console.log('Deleting wallet balances...');
    await prisma.walletBalance.deleteMany({});
    console.log('Deleting wallet keys...');
    await prisma.walletKey.deleteMany({});
    console.log('Deleting wallet transfers...');
    await prisma.walletTransfer.deleteMany({});
    console.log('Deleting wallets...');
    await prisma.wallet.deleteMany({});

    // Remove payment intents, settlements, other related records if present
    try {
      console.log('Deleting payment intents (if present)...');
      await prisma.paymentIntent.deleteMany({});
    } catch (err) {
      // ignore if model doesn't exist or deletion fails
      console.warn('paymentIntent deletion skipped or failed:', err.message || err);
    }

    try {
      console.log('Deleting settlements (if present)...');
      await prisma.settlement.deleteMany({});
      await prisma.settlementBatch.deleteMany({});
    } catch (err) {
      console.warn('settlement deletion skipped or failed:', err.message || err);
    }

    // Remove merchants
    console.log('Deleting merchants...');
    await prisma.merchant.deleteMany({});

    // Remove other merchant-scoped resources if necessary (best-effort)
    const otherModels = [
      'paymentMethod',
      'paymentIntent',
      'settlement',
      'settlementBatch',
    ];

    // Ensure admin user exists (create or update)
    console.log('Creating/updating admin user...');
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
      create: {
        email: adminEmail,
        firstName: 'Admin',
        lastName: 'User',
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    // Remove all other users
    console.log('Deleting non-admin users...');
    await prisma.user.deleteMany({ where: { email: { not: adminEmail } } });

    // Remove refresh tokens, sessions, oauth accounts, etc.
    try {
      console.log('Cleaning refresh tokens, sessions, oauth accounts...');
      await prisma.refreshToken.deleteMany({});
      await prisma.session.deleteMany({});
      await prisma.oauthAccount.deleteMany({});
    } catch (err) {
      console.warn('Cleanup of auxiliary tables skipped or failed:', err.message || err);
    }

    console.log('Database reset complete. Only admin user should remain.');
  } catch (err) {
    console.error('Reset failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
