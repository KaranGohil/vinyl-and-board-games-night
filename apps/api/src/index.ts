import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { migrate } from "./migrate.js";

const config = loadConfig();
const db = createDb(config.databaseUrl);

// Apply schema changes on boot so self-hosters never have to run migrations by hand.
await migrate(db);

const app = await buildApp({ db, config });
await app.listen({ port: config.port, host: config.host });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await db.end();
    process.exit(0);
  });
}
