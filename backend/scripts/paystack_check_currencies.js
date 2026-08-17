(async ()=>{
  try {
    const axios = (await import('axios')).default;
    const client = axios.create({
      baseURL: 'https://api.paystack.co',
      timeout: 15000,
      headers: {
        Authorization: 'Bearer sk_test_b6a1ea168f1a6994ea252b12b1c3b6ed91f9dfce',
        'Content-Type': 'application/json'
      }
    });

    const currencies = ['USD','NGN'];

    for (const cur of currencies) {
      const payload = {
        amount: '100',
        currency: cur,
        reference: `TX-CHECK-${cur}-${Date.now()}`,
        customerEmail: 'customer@example.com',
        channels: ['card']
      };

      console.log('Posting payload:', payload);

      try {
        const resp = await client.post('/transaction/initialize', payload);
        console.log(`=> ${cur} success: status=${resp.status}`);
        console.log(JSON.stringify(resp.data, null, 2));
      } catch (err) {
        console.log(`=> ${cur} failed:`);
        try {
          const anyErr = err;
          console.error('message:', anyErr.message);
          if (anyErr.response) {
            console.error('response.status:', anyErr.response.status);
            console.error('response.data:', JSON.stringify(anyErr.response.data, null, 2));
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
})();
