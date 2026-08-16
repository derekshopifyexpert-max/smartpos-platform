(async () => {
  try {
    const addr = '0x' + (Date.now().toString(16).padStart(40, '0')).slice(0,40);
    const res = await fetch('http://127.0.0.1:4000/api/v1/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          name: 'Test USDT Wallet',
          currency: 'USDT',
          blockchain: 'ETHEREUM',
          network: 'ETHEREUM',
          asset: 'USDT',
          type: 'CRYPTO',
          address: addr
        })
    });

    const j = await res.json();
    console.log(JSON.stringify(j, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
