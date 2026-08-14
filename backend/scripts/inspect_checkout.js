(async ()=>{
  try{
    const paymentIntentId = 'cmstadnf10006c17wuo7pmqz5';
    let res = await fetch(`http://localhost:4000/api/v1/payment-intents/${paymentIntentId}`);
    console.log('GET payment-intent status', res.status);
    let body = await res.text();
    console.log('GET payment-intent body:', body);

    res = await fetch(`http://localhost:4000/api/v1/payment-intents/${paymentIntentId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@example.com' })
    });
    console.log('POST checkout status', res.status);
    const text = await res.text();
    console.log('POST checkout body:', text);
  }catch(err){ console.error(err); process.exit(1); }
})();
