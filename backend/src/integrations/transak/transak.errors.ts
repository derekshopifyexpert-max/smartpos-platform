export class TransakConfigurationError extends Error {
  readonly code = "TRANSAK_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "TransakConfigurationError";
  }
}

export class TransakProviderError extends Error {
  readonly code = "TRANSAK_PROVIDER_ERROR";
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { statusCode?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "TransakProviderError";
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
  }
}
