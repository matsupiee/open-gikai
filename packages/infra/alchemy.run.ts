import alchemy, { CloudflareStateStore } from "alchemy";
import { Queue, TanStackStart, Worker } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("open-gikai", {
  password: process.env.ALCHEMY_PASSWORD,
  stateStore: (scope) => new CloudflareStateStore(scope),
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

/**
 * フロントエンドサーバーのCloudflare Worker
 */
export const web = await TanStackStart("web", {
  cwd: "../../apps/web",
  domains: ["opengikai.com"],
  bindings: {
    DATABASE_URL: alchemy.secret.env.DATABASE_URL!,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
  },
});

console.log(`Web           -> ${web.url}`);
console.log(`ScraperWorker -> ${scraperWorker.name}`);

await app.finalize();
