export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
  /** Public URL people open in their browser, used for links in calendar invites. */
  publicUrl: string;
  /** Origins allowed to call the API from a browser (only needed when web and API are on different origins). */
  corsOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required, e.g. postgres://vbgn:vbgn@localhost:5432/vbgn");
  }
  return {
    databaseUrl,
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? "0.0.0.0",
    publicUrl: (env.PUBLIC_URL ?? "http://localhost:8080").replace(/\/+$/, ""),
    corsOrigins: (env.CORS_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
