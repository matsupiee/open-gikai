import type { Db } from "../../db/src";
import * as schema from "../../db/src/schema/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
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
    plugins: [tanstackStartCookies(), admin({ defaultRole: "user" })],
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
