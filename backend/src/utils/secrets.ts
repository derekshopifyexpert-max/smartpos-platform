import axios from 'axios';

export async function loadSecrets(app: any) {
  const vaultAddr = process.env.VAULT_ADDR;
  const vaultToken = process.env.VAULT_TOKEN;

  if (!vaultAddr || !vaultToken) {
    app.log.info('Vault not configured; using environment variables for secrets');
    return;
  }

  try {
    const url = `${vaultAddr.replace(/\/$/, '')}/v1/secret/data/smartpos`;
    const res = await axios.get(url, { headers: { 'X-Vault-Token': vaultToken } });
    const secrets = res.data?.data?.data ?? {};

    for (const [k, v] of Object.entries(secrets)) {
      if (!process.env[k]) process.env[k] = String(v);
    }

    app.log.info('Loaded secrets from Vault');
  } catch (err) {
    app.log.error({ err }, 'Failed to load secrets from Vault; falling back to env');
  }
}
