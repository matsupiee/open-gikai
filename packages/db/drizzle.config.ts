import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// CI では環境変数が直接セットされるため .env ファイルは不要
// ローカルでは .env.local → .env の順で読み込む（既存の環境変数は上書きしない）
dotenv.config({ path: "../../apps/web/.env.local" });
dotenv.config({ path: "../../apps/web/.env" });

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
