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

    const resp = await client.post('/transaction/initialize', {
      email: 'test@example.com',
      amount: 10000
    });

    console.log('status', resp.status);
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (err) {
    console.error('error:', err && err.stack ? err.stack : err);
    if (err && err.response) {
      console.error('response status', err.response.status);
      console.error('response data', err.response.data);
    }
  }
})();
