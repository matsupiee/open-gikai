import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

export type MinutesDb = ReturnType<typeof drizzle<typeof schema>>;

export interface MinutesDbConfig {
  url: string;
  authToken?: string;
}

export function createMinutesDb(config: MinutesDbConfig): MinutesDb {
  const client = createClient({
    url: config.url,
    authToken: config.authToken,
  });
  return drizzle(client, { schema, casing: "snake_case" });
}
