import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@open-gikai/db/schema";

/** Worker の env.DATABASE_URL から Drizzle 接続を生成する */
export function createDb(databaseUrl: string) {
  return drizzle(databaseUrl, { schema });
}

export type Db = ReturnType<typeof createDb>;
