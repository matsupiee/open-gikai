import { env } from "@open-gikai/env/db";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export const db = drizzle(env.DATABASE_URL, { schema });

// Re-export schema for convenience
export { meetings, statements, scraper_jobs, scraper_job_logs } from "./schema";
