(async ()=>{
  try {
    const res = await fetch('http://localhost:4000/api/v1/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: 'cmsrgn10j0001c13sb1sdcryk',
        name: 'SmartPOS Test USDT Wallet',
        currency: 'USD',
        blockchain: 'ETHEREUM',
        network: 'ETHEREUM',
        asset: 'USDT',
        type: 'CRYPTO',
        metadata: { asset: 'USDT', network: 'ETHEREUM', source: 'test' }
      })
    });

    const j = await res.json();
    console.log(JSON.stringify(j, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
