(async ()=>{
  try {
    const merchantId = 'cmsrgn10j0001c13sb1sdcryk';
    // fetch wallets
    let res = await fetch(`http://localhost:4000/api/v1/merchants/${merchantId}/wallets`);
    let list = await res.json();
    console.log('merchant wallets count:', list.data?.length);
    const wallet = list.data?.[0];
    if(!wallet){ console.error('no wallet found'); process.exit(1); }
    console.log('using wallet', wallet.id, wallet.address);

    // create payment intent
    res = await fetch('http://localhost:4000/api/v1/payment-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId,
        amount: 100,
        currency: 'USD',
        description: 'Test payment intent for crypto',
        metadata: {
          cryptoDestination: {
            asset: wallet.metadata?.asset ?? 'USDT',
            network: wallet.metadata?.network ?? 'ETHEREUM',
            walletId: wallet.id,
            address: wallet.address
          }
        }
      })
    });

    let pi = await res.json();
    console.log('create payment intent response:', JSON.stringify(pi, null, 2));
    const paymentIntentId = pi.data?.id;

    // checkout
    res = await fetch(`http://localhost:4000/api/v1/payment-intents/${paymentIntentId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@example.com',
        cryptoDestination: {
          asset: wallet.metadata?.asset ?? 'USDT',
          network: wallet.metadata?.network ?? 'ETHEREUM',
          walletId: wallet.id,
          address: wallet.address
        }
      })
    });

    let checkout = await res.json();
    console.log('checkout response:', JSON.stringify(checkout, null, 2));

    // fetch transactions list
    res = await fetch('http://localhost:4000/api/v1/transactions');
    let txs = await res.json();
    console.log('transactions list sample:', JSON.stringify(txs.data?.items?.slice(0,3), null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
