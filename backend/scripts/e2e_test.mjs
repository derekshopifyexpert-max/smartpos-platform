import fetch from 'node-fetch';

const BASE = 'http://127.0.0.1:4000/api/v1';

async function run() {
  try {
    console.log('Logging in as admin...');

    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@smartpos.com', password: 'Admin@12345' }),
    });

    const loginJson = await loginRes.json();

    if (!loginJson.success) {
      console.error('Login failed', loginJson);
      process.exit(1);
    }

    const token = loginJson.data?.token;

    if (!token) {
      console.error('No token returned');
      process.exit(1);
    }

    console.log('Token acquired');

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    console.log('Listing wallets...');

    const listRes = await fetch(`${BASE}/wallets`, { headers });
    const listJson = await listRes.json();
    console.log('Wallets:', listJson.data?.length ?? 'no data');

    const addr = '0x' + (Date.now().toString(16).padStart(40, '0')).slice(0, 40);

    console.log('Creating wallet', addr);

    const createRes = await fetch(`${BASE}/wallets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'E2E Wallet',
        currency: 'USDT',
        blockchain: 'ETHEREUM',
        network: 'ETHEREUM',
        asset: 'USDT',
        type: 'CRYPTO',
        address: addr,
      }),
    });

    const createJson = await createRes.json();
    console.log('Create response', createJson.success ? 'ok' : createJson);

    const created = createJson.data;

    if (!created || !created.id) {
      console.error('Wallet creation failed');
      process.exit(1);
    }

    console.log('Created wallet id', created.id);

    console.log('Refreshing wallet list...');

    const list2 = await (await fetch(`${BASE}/wallets`, { headers })).json();
    console.log('Wallets after create:', (list2.data || []).length);

    console.log('Deleting wallet...', created.id);
    const del = await (await fetch(`${BASE}/wallets/${created.id}`, { method: 'DELETE', headers })).json();
    console.log('Delete result', del);

    console.log('Done');
  } catch (err) {
    console.error('E2E error', err);
    process.exit(1);
  }
}

run();
