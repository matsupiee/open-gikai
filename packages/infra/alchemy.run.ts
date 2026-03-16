import alchemy from "alchemy";
import { CloudflareStateStore } from "alchemy/state";
import { Hyperdrive, Queue, TanStackStart, Worker } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("open-gikai", {
  stage: "production",
  password: process.env.ALCHEMY_PASSWORD,
  stateStore: (scope) => new CloudflareStateStore(scope),
  // 既存の Cloudflare リソースを state に取り込む（初回 CI デプロイ用）
  // state 同期完了後に false に戻す
  adopt: true,
});

const scraperQueue = await Queue("scraper-jobs", {
  name: "scraper-jobs",
  settings: {
    messageRetentionPeriod: 86400, // メッセージを24時間保持
  },
});

/**
 * スクレイピング処理を実行するCloudflare Worker
 * 1分ごとに pending ジョブを確認して、ジョブがあればジョブを実行する
 */
const scraperWorker = await Worker("scraper-worker", {
  name: "open-gikai-scraper-worker",
  entrypoint: "../../apps/scraper-worker/src/index.ts",
  compatibilityFlags: ["nodejs_compat"],
  crons: ["*/1 * * * *"], // 1 分ごとに pending ジョブを確認
  eventSources: [
    {
      queue: scraperQueue,
      settings: {
        batchSize: 5, // メッセージを5件まとめて処理する
        maxConcurrency: 2, // 同時に処理するメッセージの最大数
        maxRetries: 3, // 最大リトライ回数
        retryDelay: 30, // リトライの遅延時間
      },
    },
  ],
  bindings: {
    DATABASE_URL: alchemy.secret.env.DATABASE_URL!,
    SCRAPER_QUEUE: scraperQueue,
  },
});

// DATABASE_URL のパスワードに特殊文字（@, %, ! 等）が含まれるため
// 接続文字列ではなくオブジェクト形式で origin を渡す
function parseDatabaseUrl(url: string) {
  const withoutScheme = url.replace(/^postgres(ql)?:\/\//, "");
  const lastAtIndex = withoutScheme.lastIndexOf("@");
  const userInfo = withoutScheme.slice(0, lastAtIndex);
  const hostInfo = withoutScheme.slice(lastAtIndex + 1);
  const firstColonIndex = userInfo.indexOf(":");
  const [hostPort, ...rest] = hostInfo.split("/");
  const database = (rest.join("/") || "postgres").split("?")[0]!;
  const [host, portStr] = hostPort!.split(":");
  return {
    user: userInfo.slice(0, firstColonIndex),
    password: userInfo.slice(firstColonIndex + 1),
    host: host!,
    port: Number(portStr) || 5432,
    database,
  };
}

const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL!);
const hyperdrive = await Hyperdrive("database", {
  name: "open-gikai-database",
  origin: {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    scheme: "postgres",
  },
});

/**
 * フロントエンドサーバーのCloudflare Worker
 */
export const web = await TanStackStart("web", {
  name: "open-gikai-web",
  cwd: "../../apps/web",
  domains: ["opengikai.com"],
  bindings: {
    HYPERDRIVE: hyperdrive,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
  },
});

console.log(`Web           -> ${web.url}`);
console.log(`ScraperWorker -> ${scraperWorker.name}`);

await app.finalize();
