import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { eventRoutes } from "./routes/events.js";

export async function buildApp(opts: { db: Db; config: Config; logger?: boolean }) {
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: true });

  if (opts.config.corsOrigins.length) {
    await app.register(cors, { origin: opts.config.corsOrigins });
  }

  app.get("/api/health", async () => {
    await opts.db.query("SELECT 1");
    return { ok: true };
  });

  await app.register(eventRoutes, { db: opts.db, config: opts.config });
  return app;
}
