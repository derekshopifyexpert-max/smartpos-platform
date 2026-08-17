(async ()=>{
  const { PrismaClient } = await import('@prisma/client');
  const dotenv = await import('dotenv');
  dotenv.config({ path: './.env' });

  const prisma = new PrismaClient();
  try {
    const providers = await prisma.paymentProvider.findMany();
    console.log(JSON.stringify(providers, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
