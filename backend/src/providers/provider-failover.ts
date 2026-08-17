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
    private readonly manager = new ProviderManager(),
    private readonly breaker = new CircuitBreaker(),
    private readonly metrics = new ProviderMetricsService(),
    private readonly scorer = new ProviderScoreService()
  ) {}

  async execute<T>(
    providers: string[],
    callback: (
      provider: BaseProvider,
      providerName: string
    ) => Promise<T>
  ): Promise<ProviderExecutionResult<T>> {

    let lastError: unknown;

    const rankedProviders =
      this.scorer.rank(providers);

    for (const providerName of rankedProviders) {

      if (!this.breaker.canExecute(providerName)) {

        console.warn(
          `[Circuit Open] ${providerName}`
        );

        continue;
      }

      const started = Date.now();

      // retry transient network/TLS failures once before marking provider as failed
      const maxRetries = 1;
      let attempt = 0;
      let succeeded = false;
      let lastAttemptError: unknown = undefined;

      const isTransient = (err: any) => {
        if (!err) return false;
        const msg = String(err.message ?? err).toLowerCase();
        if (msg.includes("ssl")) return true;
        if (msg.includes("bad record mac")) return true;
        if (msg.includes("tls alert")) return true;
        if (err.code && ["ECONNRESET", "ECONNABORTED", "EPIPE", "ETIMEDOUT"].includes(err.code)) return true;
        return false;
      };

      for (; attempt <= maxRetries; attempt++) {
        try {
          const provider = this.manager.getProvider(providerName);

          const result = await callback(provider, providerName);

          const duration = Date.now() - started;

          this.breaker.success(providerName);

          this.metrics.record(providerName, true, duration);

          return {
            providerName,
            result,
          };
        } catch (error) {
          lastAttemptError = error;

          // if transient and we have retries left, wait and retry
          if (attempt < maxRetries && isTransient(error)) {
            const backoff = 300 * (attempt + 1);
            console.warn(`[Failover] transient error from ${providerName}, retrying after ${backoff}ms`, error);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          const duration = Date.now() - started;

          this.breaker.failure(providerName);

          this.metrics.record(providerName, false, duration);

          console.warn(`[Failover] ${providerName} failed`, error);

          lastError = error;
          break;
        }
      }
    }

    throw (
      lastError ??
      new Error(
        "No payment provider succeeded."
      )
    );
  }

  metricsSnapshot() {
    return this.metrics.all();
  }
}
