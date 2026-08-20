import dotenv from "dotenv";
import axios from "axios";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const baseUrl = String(process.env.QUIDAX_BASE_URL || "").replace(/\/$/, "");
const apiKey = String(process.env.QUIDAX_API_KEY || "");

if (!baseUrl || !apiKey) {
  console.error("QUIDAX_API_KEY and QUIDAX_BASE_URL are required.");
  process.exitCode = 2;
} else {
  const client = axios.create({
    baseURL: baseUrl,
    timeout: Number(process.env.QUIDAX_TIMEOUT_MS || 15000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });

  for (const path of ["/markets", "/markets/tickers", "/users/me/wallets"]) {
    try {
      const response = await client.get(path);
      const body = response.data && typeof response.data === "object" ? response.data : {};
      console.log(`${path} STATUS=${response.status} PROVIDER_STATUS=${body.status || "unavailable"}`);
    } catch (error) {
      console.log(`${path} ERROR=${error instanceof Error ? error.name : "RequestError"}`);
      process.exitCode = 1;
    }
  }
}
