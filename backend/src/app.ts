import Fastify from "fastify";

import { registerPlugins } from "./plugins/index.js";

import registerRoutes from "./routes/index.js";
import { loadSecrets } from "./utils/secrets.js";

const app = Fastify({
  logger: true,
  trustProxy: process.env.TRUST_PROXY === "true",
});

async function buildApp() {

  // attempt to load secrets from Vault (if configured) before registering plugins
  await loadSecrets(app);

  await registerPlugins(app);

  await app.register(
    registerRoutes
  );

  return app;

}

export default buildApp;
