import axios from "axios";
import env from "../../config/env.js";
import { TRANSAK_GATEWAY_BASE_URLS, TRANSAK_PATHS } from "./transak.constants.js";
import { TransakConfigurationError, TransakProviderError } from "./transak.errors.js";

interface CachedToken {
  value: string;
  expiresAt: number;
}

interface RefreshTokenResponse {
  accessToken?: string;
  token?: string;
  expiresIn?: number;
  data?: {
    accessToken?: string;
    token?: string;
    expiresIn?: number;
  };
}

export class TransakAuthService {
  private cachedToken: CachedToken | null = null;
  private refreshPromise: Promise<string> | null = null;

  private getConfig() {
    const environment = env.TRANSAK_ENV;
    if (!environment || !env.TRANSAK_API_KEY || !env.TRANSAK_API_SECRET) {
      throw new TransakConfigurationError(
        "Transak is not configured. Set TRANSAK_ENV, TRANSAK_API_KEY, and TRANSAK_API_SECRET on the backend."
      );
    }

    return {
      environment,
      apiKey: env.TRANSAK_API_KEY,
      apiSecret: env.TRANSAK_API_SECRET,
      baseUrl: env.TRANSAK_API_BASE_URL || TRANSAK_GATEWAY_BASE_URLS[environment],
    };
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.value;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<string> {
    const config = this.getConfig();

    try {
      const response = await axios.post<RefreshTokenResponse>(
        `${config.baseUrl.replace(/\/$/, "")}${TRANSAK_PATHS.refreshToken}`,
        {
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
        },
        { timeout: 10_000 }
      );

      const payload = response.data.data ?? response.data;
      const accessToken = payload.accessToken || payload.token;
      if (!accessToken) {
        throw new TransakProviderError("Transak authentication returned no access token.", {
          statusCode: response.status,
        });
      }

      const expiresInSeconds = Number(payload.expiresIn || 300);
      this.cachedToken = {
        value: accessToken,
        expiresAt: Date.now() + Math.max(60, expiresInSeconds) * 1000,
      };

      return accessToken;
    } catch (error) {
      if (error instanceof TransakProviderError) throw error;
      if (axios.isAxiosError(error)) {
        throw new TransakProviderError("Transak authentication failed.", {
          statusCode: error.response?.status,
          retryable: !error.response || error.response.status >= 500,
        });
      }
      throw new TransakProviderError("Transak authentication failed.");
    }
  }
}

export const transakAuthService = new TransakAuthService();
