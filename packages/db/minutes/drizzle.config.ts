import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "sqlite",
  casing: "snake_case",
  // シャーディングにより、マイグレーションを複数のDBに対して行うことになる
  // dbCredentialsでは1つのurlしか指定できないので、このプロジェクトでは使えない
  // db:studio機能により特定のDBに対して接続を行いたい場合だけ、dbCredentialsを指定する
  // dbCredentials: {
  //   url: "",
  // },
});
