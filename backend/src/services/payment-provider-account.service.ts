import { FastifyInstance } from "fastify";
import { PaymentProviderAccount } from "@prisma/client";

/**
 * PaymentProviderAccountService
 * Manages multiple fiat payment provider accounts.
 * Provides credential resolution and account listing with safety checks.
 */
export default class PaymentProviderAccountService {
  constructor(private readonly app: FastifyInstance) {}

  /**
   * List all available payment provider accounts (safe metadata only)
   * Never includes secret keys
   */
  async listAccounts() {
    const accounts = await this.app.prisma.paymentProviderAccount.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        displayName: true,
        provider: true,
        currency: true,
        status: true,
        publicKey: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return accounts.map(account => ({
      ...account,
      configured: account.status === 'ACTIVE',
    }));
  }

  /**
   * Get a single account by ID (safe metadata)
   */
  async getAccount(id: string) {
    const account = await this.app.prisma.paymentProviderAccount.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        displayName: true,
        provider: true,
        currency: true,
        status: true,
        publicKey: true,
        isDefault: true,
        createdAt: true,
      },
    });

    if (!account) return null;

    return {
      ...account,
      configured: account.status === 'ACTIVE',
    };
  }

  /**
   * Resolve credentials for an account
   * Throws if account is not configured
   * In production, secretKeyRef would be resolved from Vault
   */
  async resolveCredentials(accountId: string) {
    const account = await this.app.prisma.paymentProviderAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Payment provider account not found: ${accountId}`);
    }

    if (account.status !== 'ACTIVE') {
      throw new Error(
        `Payment provider account is not configured. Account: ${account.displayName}`
      );
    }

    // In production, resolve secretKeyRef from Vault or secrets manager
    // For now, return the account and let the caller handle secret resolution
    const secretKey = await this.resolveSecretKey(account.secretKeyRef);

    if (!secretKey) {
      throw new Error(
        `Credentials not available for account: ${account.displayName}`
      );
    }

    return {
      accountId: account.id,
      provider: account.provider,
      currency: account.currency,
      publicKey: account.publicKey,
      secretKey, // This would be retrieved from Vault in production
    };
  }

  /**
   * Get account by name (convenience method)
   */
  async getAccountByName(name: string) {
    const account = await this.app.prisma.paymentProviderAccount.findUnique({
      where: { name },
      select: {
        id: true,
        name: true,
        displayName: true,
        provider: true,
        currency: true,
        status: true,
        publicKey: true,
        isDefault: true,
      },
    });

    if (!account) return null;

    return {
      ...account,
      configured: account.status === 'ACTIVE',
    };
  }

  /**
   * Get the default account for a provider and currency
   */
  async getDefaultAccount(provider: string, currency: string) {
    const account = await this.app.prisma.paymentProviderAccount.findFirst({
      where: {
        provider,
        currency,
        isDefault: true,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        provider: true,
        currency: true,
        status: true,
        publicKey: true,
      },
    });

    return account;
  }

  /**
   * Get accounts by provider
   */
  async getAccountsByProvider(provider: string) {
    const accounts = await this.app.prisma.paymentProviderAccount.findMany({
      where: {
        provider,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        provider: true,
        currency: true,
        status: true,
        publicKey: true,
        isDefault: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return accounts.map(account => ({
      ...account,
      configured: account.status === 'ACTIVE',
    }));
  }

  /**
   * Resolve secret key from environment or Vault
   * This is a placeholder for the actual secret resolution logic
   */
  private async resolveSecretKey(secretKeyRef: string | null) {
    if (!secretKeyRef) return null;

    // For now, try to resolve from environment variables
    // In production, this would call a Vault API or secrets manager
    const envKey = process.env[secretKeyRef];
    if (envKey) return envKey;

    // If not in env and VAULT_ADDR is set, attempt Vault lookup
    if (process.env.VAULT_ADDR) {
      try {
        const { default: axios } = await import('axios');
        const url = `${process.env.VAULT_ADDR.replace(/\/$/, '')}/v1/secret/data/smartpos/payment-accounts`;
        const res = await axios.get(url, {
          headers: { 'X-Vault-Token': process.env.VAULT_TOKEN },
        });

        const secrets = res.data?.data?.data ?? {};
        return secrets[secretKeyRef] ?? null;
      } catch (err) {
        this.app.log.warn(
          { err, secretKeyRef },
          'Failed to resolve secret from Vault'
        );
        return null;
      }
    }

    return null;
  }

  /**
   * Check if an account is properly configured
   */
  async isConfigured(accountId: string): Promise<boolean> {
    const account = await this.app.prisma.paymentProviderAccount.findUnique({
      where: { id: accountId },
      select: { status: true, secretKeyRef: true },
    });

    if (!account) return false;
    if (account.status !== 'ACTIVE') return false;

    // Check if we can resolve the secret key
    const hasSecret = await this.resolveSecretKey(account.secretKeyRef);
    return !!hasSecret;
  }

  /**
   * Create or update an account (admin operation)
   */
  async upsertAccount(data: {
    name: string;
    displayName: string;
    provider: string;
    currency: string;
    publicKey?: string;
    secretKeyRef?: string;
    status?: 'ACTIVE' | 'NOT_CONFIGURED' | 'DISABLED' | 'SUSPENDED';
    isDefault?: boolean;
  }) {
    return this.app.prisma.paymentProviderAccount.upsert({
      where: { name: data.name },
      update: {
        displayName: data.displayName,
        currency: data.currency,
        publicKey: data.publicKey,
        secretKeyRef: data.secretKeyRef,
        status: data.status,
        isDefault: data.isDefault,
      },
      create: {
        name: data.name,
        displayName: data.displayName,
        provider: data.provider,
        currency: data.currency,
        publicKey: data.publicKey,
        secretKeyRef: data.secretKeyRef,
        status: data.status || 'NOT_CONFIGURED',
        isDefault: data.isDefault || false,
      },
    });
  }
}
