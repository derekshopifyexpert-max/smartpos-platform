export class QuidaxConfigurationError extends Error {
  readonly code = "QUIDAX_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "QuidaxConfigurationError";
  }
}

export class QuidaxProviderError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly category: string;

  constructor(message: string, options: { code?: string; status?: number; retryable?: boolean; category?: string } = {}) {
    super(message);
    this.name = "QuidaxProviderError";
    this.code = options.code ?? "QUIDAX_PROVIDER_ERROR";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.category = options.category ?? "UNKNOWN_PROVIDER_ERROR";
  }
}
