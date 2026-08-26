import BaseProvider from "./base.provider.js";
import ProviderManager from "./provider.manager.js";
import CircuitBreaker from "./circuit-breaker.js";
import ProviderMetricsService from "./provider-metrics.service.js";
import ProviderScoreService from "./provider-score.service.js";

export interface ProviderExecutionResult<T> {
  providerName: string;
  result: T;
}

export default class ProviderFailover {
  constructor(
    private readonly manager =
      new ProviderManager(),

    private readonly breaker =
      new CircuitBreaker(),

    private readonly metrics =
      new ProviderMetricsService(),

    private readonly scorer =
      new ProviderScoreService(),
  ) {}

  async execute<T>(
    providers: string[],
    callback: (
      provider: BaseProvider,
      providerName: string,
    ) => Promise<T>,
  ): Promise<ProviderExecutionResult<T>> {
    const normalizedProviders =
      providers
        .map(provider =>
          String(provider ?? "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean);

    if (!normalizedProviders.length) {
      throw new Error(
        "No payment provider configured.",
      );
    }

    let lastError: unknown;

    const rankedProviders =
      this.scorer.rank(
        normalizedProviders,
      );

    for (const providerName of rankedProviders) {
      if (
        !this.breaker.canExecute(
          providerName,
        )
      ) {
        continue;
      }

      const started =
        Date.now();

      const maxRetries = 1;

      for (
        let attempt = 0;
        attempt <= maxRetries;
        attempt++
      ) {
        try {
          const provider =
            this.manager.getProvider(
              providerName,
            );

          const result =
            await callback(
              provider,
              providerName,
            );

          const duration =
            Date.now() -
            started;

          this.breaker.success(
            providerName,
          );

          this.metrics.record(
            providerName,
            true,
            duration,
          );

          return {
            providerName,
            result,
          };
        } catch (error) {
          lastError = error;

          const retryable =
            attempt < maxRetries &&
            this.isTransientError(
              error,
            );

          if (retryable) {
            const backoff =
              300 *
              (attempt + 1);

            await this.delay(
              backoff,
            );

            continue;
          }

          const duration =
            Date.now() -
            started;

          this.breaker.failure(
            providerName,
          );

          this.metrics.record(
            providerName,
            false,
            duration,
          );

          break;
        }
      }
    }

    throw (
      lastError ??
      new Error(
        "No payment provider succeeded.",
      )
    );
  }

  metricsSnapshot() {
    return this.metrics.all();
  }

  private isTransientError(
    error: unknown,
  ): boolean {
    if (!error) {
      return false;
    }

    const candidate =
      error as {
        code?: string;
        message?: string;
      };

    const code =
      candidate.code
        ?.trim()
        .toUpperCase();

    if (
      code &&
      [
        "ECONNRESET",
        "ECONNABORTED",
        "EPIPE",
        "ETIMEDOUT",
      ].includes(code)
    ) {
      return true;
    }

    const message =
      String(
        candidate.message ??
          error,
      ).toLowerCase();

    return (
      message.includes("ssl") ||
      message.includes(
        "bad record mac",
      ) ||
      message.includes(
        "tls alert",
      ) ||
      message.includes(
        "certificate",
      )
    );
  }

  private async delay(
    milliseconds: number,
  ): Promise<void> {
    await new Promise<void>(
      resolve =>
        setTimeout(
          resolve,
          milliseconds,
        ),
    );
  }
}