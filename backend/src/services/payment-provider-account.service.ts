import { FastifyInstance } from 'fastify';

/**
 * PaymentProviderAccountService
 *
 * Manages multiple fiat payment provider accounts.
 *
 * Responsibilities:
 * - List safe account metadata
 * - Retrieve individual accounts
 * - Resolve provider credentials
 * - Check account configuration
 * - Find accounts by name/provider
 * - Find default accounts
 * - Create/update accounts
 *
 * Security:
 * - Secret keys are never returned by list/get methods.
 * - secretKeyRef is only used internally for credential resolution.
 * - Actual secret values should live in environment variables or Vault.
 */
export default class PaymentProviderAccountService {
  constructor(private readonly app: FastifyInstance) {}

  /**
   * List all available payment provider accounts.
   *
   * Only safe metadata is returned.
   * Secret keys and secretKeyRef are never exposed.
   */
  async listAccounts() {
    const accounts =
      await this.app.prisma.paymentProviderAccount.findMany({
        where: {
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
          createdAt: true,
        },
        orderBy: [
          {
            isDefault: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
      });

    return accounts.map((account) => ({
      ...account,
      configured: account.status === 'ACTIVE',
    }));
  }

  /**
   * Get a single payment provider account by ID.
   *
   * Deleted accounts are not returned.
   * Secret keys are never returned.
   */
  async getAccount(id: string) {
    const account =
      await this.app.prisma.paymentProviderAccount.findFirst({
        where: {
          id,
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
          createdAt: true,
        },
      });

    if (!account) {
      return null;
    }

    return {
      ...account,
      configured: account.status === 'ACTIVE',
    };
  }

  /**
   * Resolve credentials for a payment provider account.
   *
   * Throws if:
   * - The account does not exist
   * - The account is deleted
   * - The account is not ACTIVE
   * - The secret cannot be resolved
   *
   * The actual secret should come from an environment variable
   * or Vault, never directly from the database.
   */
  async resolveCredentials(accountId: string) {
    const account =
      await this.app.prisma.paymentProviderAccount.findFirst({
        where: {
          id: accountId,
          deletedAt: null,
        },
      });

    if (!account) {
      throw new Error(
        `Payment provider account not found: ${accountId}`,
      );
    }

    if (account.status !== 'ACTIVE') {
      throw new Error(
        `Payment provider account is not configured. Account: ${account.displayName}`,
      );
    }

    const secretKey = await this.resolveSecretKey(
      account.secretKeyRef,
    );

    if (!secretKey) {
      throw new Error(
        `Credentials not available for account: ${account.displayName}`,
      );
    }

    return {
      accountId: account.id,
      provider: account.provider,
      currency: account.currency,
      publicKey: account.publicKey,
      secretKey,
    };
  }

  /**
   * Get an account by its unique name.
   *
   * Deleted accounts are excluded.
   */
  async getAccountByName(name: string) {
    const account =
      await this.app.prisma.paymentProviderAccount.findFirst({
        where: {
          name,
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
      });

    if (!account) {
      return null;
    }

    return {
      ...account,
      configured: account.status === 'ACTIVE',
    };
  }

  /**
   * Get the active default account for a provider and currency.
   */
  async getDefaultAccount(
    provider: string,
    currency: string,
  ) {
    const account =
      await this.app.prisma.paymentProviderAccount.findFirst({
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
          isDefault: true,
        },
      });

    if (!account) {
      return null;
    }

    return {
      ...account,
      configured: account.status === 'ACTIVE',
    };
  }

  /**
   * Get all accounts belonging to a provider.
   *
   * Deleted accounts are excluded.
   */
  async getAccountsByProvider(provider: string) {
    const accounts =
      await this.app.prisma.paymentProviderAccount.findMany({
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
          createdAt: true,
        },
        orderBy: [
          {
            isDefault: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
      });

    return accounts.map((account) => ({
      ...account,
      configured: account.status === 'ACTIVE',
    }));
  }

  /**
   * Resolve a secret key from:
   *
   * 1. Environment variable
   * 2. HashiCorp Vault
   *
   * secretKeyRef is the name/reference, not the actual secret.
   */
  private async resolveSecretKey(
    secretKeyRef: string | null,
  ): Promise<string | null> {
    if (!secretKeyRef) {
      return null;
    }

    /**
     * First attempt:
     *
     * If secretKeyRef is something like:
     * The secretKeyRef is resolved dynamically from the environment.
     * For Flutterwave, this will normally be FLUTTERWAVE_SECRET_KEY.
     * The reference itself is never treated as the secret value.
    const envKey = process.env[secretKeyRef];

    if (envKey) {
      return envKey;
    }

    /**
     * Second attempt:
     *
     * Resolve from Vault if VAULT_ADDR is configured.
     */
    const vaultAddress = process.env.VAULT_ADDR;

    if (!vaultAddress) {
      return null;
    }

    try {
      const baseUrl = vaultAddress.replace(/\/+$/, '');

      const vaultUrl =
        `${baseUrl}/v1/secret/data/smartpos/payment-accounts`;

      const headers: Record<string, string> = {};

      const vaultToken = process.env.VAULT_TOKEN;

      if (vaultToken) {
        headers['X-Vault-Token'] = vaultToken;
      }

      const response = await fetch(vaultUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(
          `Vault returned HTTP ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        data?: {
          data?: Record<string, unknown>;
        };
      };

      const secrets = data?.data?.data ?? {};

      const secret = secrets[secretKeyRef];

      if (typeof secret === 'string' && secret.length > 0) {
        return secret;
      }

      return null;
    } catch (error) {
      this.app.log.warn(
        {
          err: error,
          secretKeyRef,
        },
        'Failed to resolve secret from Vault',
      );

      return null;
    }
  }

  /**
   * Check whether an account exists, is ACTIVE,
   * and has a resolvable secret.
   */
  async isConfigured(accountId: string): Promise<boolean> {
    const account =
      await this.app.prisma.paymentProviderAccount.findFirst({
        where: {
          id: accountId,
          deletedAt: null,
        },
        select: {
          status: true,
          secretKeyRef: true,
        },
      });

    if (!account) {
      return false;
    }

    if (account.status !== 'ACTIVE') {
      return false;
    }

    const secretKey = await this.resolveSecretKey(
      account.secretKeyRef,
    );

    return Boolean(secretKey);
  }

  /**
   * Create or update a payment provider account.
   *
   * This is an administrative operation.
   *
   * NOTE:
   * secretKeyRef is stored, never the actual secret key.
   */
  async upsertAccount(data: {
    name: string;
    displayName: string;
    provider: string;
    currency: string;
    publicKey?: string;
    secretKeyRef?: string;
    status?:
      | 'ACTIVE'
      | 'NOT_CONFIGURED'
      | 'DISABLED'
      | 'SUSPENDED';
    isDefault?: boolean;
  }) {
    const account =
      await this.app.prisma.paymentProviderAccount.upsert({
        where: {
          name: data.name,
        },

        update: {
          displayName: data.displayName,
          provider: data.provider,
          currency: data.currency,
          publicKey: data.publicKey,
          secretKeyRef: data.secretKeyRef,
          status: data.status,
          isDefault: data.isDefault,
          deletedAt: null,
        },

        create: {
          name: data.name,
          displayName: data.displayName,
          provider: data.provider,
          currency: data.currency,
          publicKey: data.publicKey,
          secretKeyRef: data.secretKeyRef,
          status: data.status ?? 'NOT_CONFIGURED',
          isDefault: data.isDefault ?? false,
        },
      });

    return account;
  }
}