import Fastify from "fastify";

import { registerPlugins } from "./plugins/index.js";

import registerRoutes from "./routes/index.js";

const app = Fastify({
  logger: true
});

async function buildApp() {


  await registerPlugins(app);


  await app.register(
    registerRoutes
  );


  return app;

}

export default buildApp;
