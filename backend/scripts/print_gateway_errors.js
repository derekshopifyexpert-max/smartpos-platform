(async ()=>{
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const responses = await prisma.gatewayResponse.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { gatewayRequest: true }
    });

    for (const r of responses) {
      console.log('---');
      console.log('id:', r.id);
      console.log('createdAt:', r.createdAt);
      console.log('gatewayRequestId:', r.gatewayRequestId);
      console.log('gatewayRequest.endpoint:', r.gatewayRequest?.endpoint);
      console.log('gatewayRequest.requestBody:', JSON.stringify(r.gatewayRequest?.requestBody));
      console.log('gatewayRequest.requestHeaders:', JSON.stringify(r.gatewayRequest?.requestHeaders));
      console.log('statusCode:', r.statusCode);
      console.log('error:', r.error);
      console.log('responseBody:', JSON.stringify(r.responseBody));
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
