---
name: scraper-troubleshooting
description: open-gikai スクレイパーのトラブルシューティング手順と既知のハマりポイント
version: 2.0.0
source: local-git-analysis
---

# Scraper Troubleshooting

## アーキテクチャ概要

```
DB (scraper_jobs: status=pending)
  ↓ scheduled cron (1分毎) — apps/scraper-worker/src/index.ts
dispatchJob() — systemType に応じて最初のキューメッセージを投入
  ↓ Cloudflare Queue (SCRAPER_QUEUE binding)
handleQueueMessage() — メッセージタイプで分岐
  ↓
  discussnet-ssp:schedule → discussnet-ssp:minute
  dbsearch:list → dbsearch:detail
  kensakusystem:list → kensakusystem:detail
  gijiroku-com:list → gijiroku-com:detail
```

ローカル開発は `local-runner.local.ts` で代替。LocalQueue がインメモリキューとして Cloudflare Queue を模倣する。

---

## ローカルで動作確認する手順

### 前提条件

- `.env.local` がプロジェクトルートに存在し、`DATABASE_URL` が設定されていること
- `bun install` が完了していること
- DB にマイグレーションが適用済みであること

### Step 1: 対象自治体の情報を確認する

`apps/scraper-worker` ディレクトリで実行する。

```ts
// bun -e で実行
import dotenv from "dotenv";
import { resolve } from "node:path";
dotenv.config({ path: resolve(process.cwd(), "../../.env.local"), override: true });
import { createDb } from "@open-gikai/db";
import { municipalities, system_types } from "@open-gikai/db/schema";
import { eq } from "drizzle-orm";

const db = createDb(process.env.DATABASE_URL!);
const result = await db
  .select({
    id: municipalities.id,
    name: municipalities.name,
    baseUrl: municipalities.baseUrl,
    systemTypeId: municipalities.systemTypeId,
  })
  .from(municipalities)
  .where(eq(municipalities.name, "秋田市")) // ← 対象自治体名に変更
  .limit(1);
console.log(JSON.stringify(result, null, 2));
process.exit(0);
```

### Step 2: pending ジョブを作成する

```ts
// bun -e で実行（apps/scraper-worker ディレクトリ）
import dotenv from "dotenv";
import { resolve } from "node:path";
dotenv.config({ path: resolve(process.cwd(), "../../.env.local"), override: true });
import { createDb } from "@open-gikai/db";
import { scraper_jobs } from "@open-gikai/db/schema";

const db = createDb(process.env.DATABASE_URL!);
const [job] = await db.insert(scraper_jobs).values({
  municipalityId: "xctahgcha1eklqi9cmolimcu", // ← Step 1 で確認した ID
  year: 2024, // ← 対象年
  status: "pending",
}).returning();
console.log("Created job:", JSON.stringify(job, null, 2));
process.exit(0);
```

### Step 3: local-runner を実行する

```bash
# apps/scraper-worker ディレクトリで
bun src/utils/local-runner.local.ts
```

**注意**: local-runner は `LocalQueue`（インメモリキュー）を使うため、Cloudflare Queue の `SCRAPER_QUEUE` バインディングは不要。本番の Queue バインディング問題はローカルでは再現しない。

### Step 4: 結果を確認する

```ts
// bun -e で実行（apps/scraper-worker ディレクトリ）
import dotenv from "dotenv";
import { resolve } from "node:path";
dotenv.config({ path: resolve(process.cwd(), "../../.env.local"), override: true });
import { createDb } from "@open-gikai/db";
import { scraper_jobs, scraper_job_logs } from "@open-gikai/db/schema";
import { eq, desc } from "drizzle-orm";

const db = createDb(process.env.DATABASE_URL!);

const jobs = await db.select().from(scraper_jobs)
  .orderBy(desc(scraper_jobs.createdAt)).limit(3);

for (const job of jobs) {
  console.log(`Job: ${job.id} | status=${job.status} | inserted=${job.totalInserted} | skipped=${job.totalSkipped}`);
  if (job.errorMessage) console.log("  error:", job.errorMessage);
  const logs = await db.select().from(scraper_job_logs)
    .where(eq(scraper_job_logs.jobId, job.id))
    .orderBy(desc(scraper_job_logs.createdAt))
    .limit(10);
  for (const log of logs) console.log(`  [${log.level}] ${log.message}`);
}
process.exit(0);
```

---

## Cloudflare Worker のビルド確認

wrangler.toml の設定が正しいかは dry-run で確認できる。

```bash
# apps/scraper-worker ディレクトリで
bunx wrangler deploy --dry-run --outdir /tmp/scraper-build
```

出力の `Your Worker has access to the following bindings:` セクションで `env.SCRAPER_QUEUE` が表示されることを確認する。

---

## 既知のハマりポイント

### wrangler.toml: Queue のプロデューサーバインディングが必要

`[[queues.consumers]]` だけでなく `[[queues.producers]]` も必要。これがないと `env.SCRAPER_QUEUE` が `undefined` になり、`dispatchJob` 内の `queue.send()` で `TypeError: Cannot read properties of undefined (reading 'send')` が発生する。

```toml
# 両方必要
[[queues.producers]]
queue = "scraper-jobs"
binding = "SCRAPER_QUEUE"

[[queues.consumers]]
queue = "scraper-jobs"
```

### fetchPage 系関数がエラーを握り潰す

外部サイトへの fetch でエラーが発生しても `null` を返す実装が多い。調査時は必ず curl で直接叩いて HTTP レスポンスを目視確認する。

### scraper_jobs.status のライフサイクル

```
pending → queued (scheduled cron が投入時)
        → running (dispatchJob 開始時)
        → completed | failed (各 handler 終了時)
        → cancelled (GUI 操作)
```

`queued` のまま止まっている場合は worker が起動していない（ローカルでは cron が動かない）。ローカルでは `local-runner.local.ts` を手動実行する。

### local-runner と本番の差異

| 項目 | 本番 (Cloudflare Worker) | ローカル (local-runner) |
|------|--------------------------|------------------------|
| キュー | Cloudflare Queue (`SCRAPER_QUEUE` binding) | LocalQueue（インメモリ） |
| 実行 | 非同期・並行 | 同期・逐次 |
| 環境変数 | wrangler.toml + Cloudflare ダッシュボード | `.env.local` |
| cron | `scheduled()` が自動で pending を検出 | 手動で `local-runner.local.ts` を実行 |

本番固有の問題（Queue バインディング、環境変数の欠落など）はローカルでは再現しない。`bunx wrangler deploy --dry-run` でバインディングの確認を行うこと。
