import { buildApp } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";

/** Load apps/api/.env when present; real environment variables win normally. */
function bootstrapDotEnv(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.warn(`Ignoring unreadable .env file: ${err.message}`);
    }
  }
}

async function main(): Promise<void> {
  let config;
  try {
    bootstrapDotEnv();
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      // Configuration errors must crash loudly and legibly at boot.
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const app = await buildApp({ config });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
  console.error("Failed to start Worlds.fm API:", error);
  process.exit(1);
});
