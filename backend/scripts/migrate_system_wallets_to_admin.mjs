import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@smartpos.com';
  const systemEmail = 'system@smartpos.internal';

  try {
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!adminUser) {
      console.log('No admin user found; skipping migration.');
      return;
    }

    // Ensure admin has a merchant
    let adminMerchant = null;

    if (adminUser.merchantId) {
      adminMerchant = await prisma.merchant.findUnique({ where: { id: adminUser.merchantId } });
    }

    if (!adminMerchant) {
      adminMerchant = await prisma.merchant.create({
        data: {
          name: 'Admin Merchant',
          businessType: 'INTERNAL',
          email: adminEmail,
          timezone: 'UTC',
          status: 'ACTIVE',
        },
      });

      await prisma.user.update({ where: { id: adminUser.id }, data: { merchantId: adminMerchant.id } });

      console.log('Created admin merchant:', adminMerchant.id);
    }

    const systemMerchant = await prisma.merchant.findUnique({ where: { email: systemEmail } });

    if (!systemMerchant) {
      console.log('No system merchant found; nothing to migrate.');
      return;
    }

    // Move wallets
    const moved = await prisma.wallet.updateMany({ where: { merchantId: systemMerchant.id }, data: { merchantId: adminMerchant.id } });

    console.log('Moved wallets count:', moved.count);

    // Optionally delete system merchant if no longer referenced
    const remainingWallets = await prisma.wallet.count({ where: { merchantId: systemMerchant.id } });

    if (remainingWallets === 0) {
      await prisma.merchant.delete({ where: { id: systemMerchant.id } });
      console.log('Deleted system merchant:', systemMerchant.id);
    } else {
      console.log('System merchant still has wallets; not deleting.');
    }
  } catch (err) {
    console.error('Migration failed', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
