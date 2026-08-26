export interface CircuitState {
  failures: number;
  openedAt?: number;
}

export default class CircuitBreaker {
  private readonly circuits =
    new Map<string, CircuitState>();

  constructor(
    private readonly failureThreshold = 5,
    private readonly cooldown = 30_000,
  ) {}

  canExecute(
    provider: string,
  ): boolean {
    const normalizedProvider =
      this.normalizeProvider(provider);

    const state =
      this.circuits.get(
        normalizedProvider,
      );

    if (!state) {
      return true;
    }

    if (
      state.failures <
      this.failureThreshold
    ) {
      return true;
    }

    if (
      state.openedAt === undefined
    ) {
      return false;
    }

    if (
      Date.now() -
        state.openedAt >=
      this.cooldown
    ) {
      this.circuits.delete(
        normalizedProvider,
      );

      return true;
    }

    return false;
  }

  success(
    provider: string,
  ): void {
    this.circuits.delete(
      this.normalizeProvider(
        provider,
      ),
    );
  }

  failure(
    provider: string,
  ): void {
    const normalizedProvider =
      this.normalizeProvider(
        provider,
      );

    const state =
      this.circuits.get(
        normalizedProvider,
      ) ?? {
        failures: 0,
      };

    state.failures += 1;

    if (
      state.failures >=
      this.failureThreshold
    ) {
      state.openedAt =
        state.openedAt ??
        Date.now();
    }

    this.circuits.set(
      normalizedProvider,
      state,
    );
  }

  status(): Array<
    CircuitState & {
      provider: string;
    }
  > {
    return Array.from(
      this.circuits.entries(),
    ).map(
      ([provider, state]) => ({
        provider,
        ...state,
      }),
    );
  }

  private normalizeProvider(
    provider: string,
  ): string {
    const normalized =
      String(provider ?? "")
        .trim()
        .toLowerCase();

    if (!normalized) {
      throw new Error(
        "Payment provider is required.",
      );
    }

    return normalized;
  }
}