import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "sqlite",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.LIBSQL_URL ?? "file:../../../data/minutes/minutes.db",
  },
});
