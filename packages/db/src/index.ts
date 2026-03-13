import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

/**
 * Drizzle 接続を生成する。
 * 呼び出し側（web, scraper-worker 等）で DATABASE_URL を渡して使用する。
 */
export function createDb(databaseUrl: string) {
  return drizzle(databaseUrl, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

// Re-export schema for convenience
export { meetings, statements, scraper_jobs, scraper_job_logs, municipalities } from "./schema";
