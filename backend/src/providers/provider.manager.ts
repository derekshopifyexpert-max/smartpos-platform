import BaseProvider from "./base.provider.js";
import ProviderFactory from "./provider.factory.js";

export default class ProviderManager {
  private readonly providers =
    new Map<string, BaseProvider>();

  /**
   * Resolve a provider by name.
   *
   * Provider names are normalized so:
   *   Flutterwave
   *   FLUTTERWAVE
   *   flutterwave
   *
   * all resolve to the same cached provider instance.
   */
  getProvider(
    provider: string,
  ): BaseProvider {
    const normalizedProvider =
      String(provider ?? "")
        .trim()
        .toLowerCase();

    if (!normalizedProvider) {
      throw new Error(
        "Payment provider is required.",
      );
    }

    const existing =
      this.providers.get(
        normalizedProvider,
      );

    if (existing) {
      return existing;
    }

    const instance =
      ProviderFactory.create(
        normalizedProvider,
      );

    this.providers.set(
      normalizedProvider,
      instance,
    );

    return instance;
  }

  /**
   * Check whether a provider has already been
   * instantiated and cached.
   */
  hasProvider(
    provider: string,
  ): boolean {
    const normalizedProvider =
      String(provider ?? "")
        .trim()
        .toLowerCase();

    if (!normalizedProvider) {
      return false;
    }

    return this.providers.has(
      normalizedProvider,
    );
  }

  /**
   * Clear all cached provider instances.
   */
  clear(): void {
    this.providers.clear();
  }
}