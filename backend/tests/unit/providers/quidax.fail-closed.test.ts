import { QuidaxClient } from "../../../src/providers/quidax/quidax.client";
import { QuidaxConfigurationError } from "../../../src/providers/quidax/quidax.errors";

describe("Quidax provider contract guard", () => {
  it("does not create a client when authentication is unverified", () => {
    expect(() => new QuidaxClient({
      apiKey: "test-only",
      baseUrl: "https://provider.invalid",
      timeoutMs: 1000,
    })).toThrow(QuidaxConfigurationError);
  });
});
