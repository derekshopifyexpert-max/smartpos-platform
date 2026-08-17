import "dotenv/config";
import buildApp from "./app.js";
import createConfirmationWorker from "./workers/confirmation.worker.js";

async function start() {
  const app =
    await buildApp();

  const PORT =
    Number(
      process.env.PORT
    ) || 4000;

  const HOST =
    process.env.HOST ||
    "0.0.0.0";

  let shuttingDown = false;
  let confirmationWorker: { stop: () => Promise<void> } | null = null;

  const shutdown = async (
    signal: NodeJS.Signals
  ) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    console.log(
      `Received ${signal}. Shutting down gracefully...`
    );

    try {
      await app.close();

      if (confirmationWorker) {
        try {
          await confirmationWorker.stop();
        } catch (err) {
          console.error('Error stopping confirmation worker', err);
        }
      }

      console.log(
        "SmartPOS API shutdown complete."
      );

      process.exit(0);
    } catch (error) {
      console.error(
        "Graceful shutdown failed:",
        error
      );

      process.exit(1);
    }
  };

  process.on(
    "SIGINT",
    () => {
      void shutdown("SIGINT");
    }
  );

  process.on(
    "SIGTERM",
    () => {
      void shutdown("SIGTERM");
    }
  );

  try {
    if (
      process.env.NODE_ENV ===
      "development"
    ) {
      console.log(
        app.printRoutes()
      );
    }

    await app.listen({
      port: PORT,
      host: HOST
    });

    app.log.info(
      `SmartPOS API running on ${HOST}:${PORT}`
    );

    // start confirmation worker if enabled
    if (process.env.ENABLE_CONFIRMATION_WORKER !== 'false') {
      try {
        confirmationWorker = createConfirmationWorker(app);
        app.log.info('Confirmation worker started');
      } catch (err) {
        app.log.error({ err }, 'Failed to start confirmation worker');
      }
    }
  } catch (error) {
    app.log.error(error);

    process.exit(1);
  }
}

start();
