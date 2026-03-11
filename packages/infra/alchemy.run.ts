import alchemy from "alchemy";
import { Queue, TanStackStart, Worker } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("open-gikai");

const scraperQueue = await Queue("scraper-jobs", {
  name: "scraper-jobs",
  settings: {
    messageRetentionPeriod: 86400, // 24 時間
  },
});

const scraperWorker = await Worker("scraper-worker", {
  entrypoint: "../../apps/scraper-worker/src/index.ts",
  crons: ["*/1 * * * *"], // 1 分ごとに pending ジョブを確認
  eventSources: [
    {
      queue: scraperQueue,
      settings: {
        batchSize: 5,
        maxConcurrency: 2,
        maxRetries: 3,
        retryDelay: 30,
      },
    },
  ],
  bindings: {
    DATABASE_URL: alchemy.secret.env.DATABASE_URL!,
    SCRAPER_QUEUE: scraperQueue,
  },
});

export const web = await TanStackStart("web", {
  cwd: "../../apps/web",
  bindings: {
    DATABASE_URL: alchemy.secret.env.DATABASE_URL!,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    INGEST_API_KEY: alchemy.secret.env.INGEST_API_KEY!,
  },
});

console.log(`Web           -> ${web.url}`);
console.log(`ScraperWorker -> ${scraperWorker.name}`);

await app.finalize();
