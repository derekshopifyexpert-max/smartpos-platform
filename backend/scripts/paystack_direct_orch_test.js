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

    const payload = {
      amount: '100',
      currency: 'USD',
      reference: 'TX-TEST-ORCH-12345',
      customerEmail: 'customer@example.com'
    };

    console.log('Posting payload:', payload);

    const resp = await client.post('/transaction/initialize', payload);

    console.log('status', resp.status);
    console.log('data', JSON.stringify(resp.data, null, 2));
  } catch (err) {
    console.error('error type:', err && err.constructor && err.constructor.name);
    // print axios error details
    try {
      const anyErr = err;
      console.error('message:', anyErr.message);
      if (anyErr.response) {
        console.error('response.status:', anyErr.response.status);
        console.error('response.data:', JSON.stringify(anyErr.response.data, null, 2));
        console.error('response.headers:', JSON.stringify(anyErr.response.headers || {}, null, 2));
      }
    } catch (e) {
      console.error(e);
    }
  }
})();
