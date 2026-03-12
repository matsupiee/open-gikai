import type { Db } from "@open-gikai/db";
import * as schema from "@open-gikai/db/schema/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export interface CreateAuthOptions {
  db: Db;
  trustedOrigins: string;
}

export function createAuth({ db, trustedOrigins }: CreateAuthOptions) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
      usePlural: true,
    }),
    trustedOrigins: [trustedOrigins],
    emailAndPassword: {
      enabled: true,
    },
    plugins: [tanstackStartCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
