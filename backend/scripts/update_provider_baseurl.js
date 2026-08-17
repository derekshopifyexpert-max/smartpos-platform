(async ()=>{
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const updated = await prisma.paymentProvider.updateMany({
      where: { name: 'paystack' },
      data: { baseUrl: 'https://api.paystack.co' }
    });
    console.log('updated', updated);
    const providers = await prisma.paymentProvider.findMany();
    console.log(JSON.stringify(providers, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
