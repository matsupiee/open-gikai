---
name: scraper-troubleshooting
description: open-gikai スクレイパーのトラブルシューティング手順と既知のハマりポイント
version: 1.0.0
source: local-git-analysis
---

# Scraper Troubleshooting

## アーキテクチャ概要

```
DB (scraper_jobs: status=pending)
  ↓ scheduled cron (1分毎)
Cloudflare Queue → scraper-worker
  ↓ message type switch
  start-job → ndl-page / kagoshima-council / local-target
```

ローカル開発は `bun --env-file ../web/.env src/utils/local-runner.ts` で代替。
LocalQueue がインメモリキューとして Cloudflare Queue を模倣する。

---

## デバッグ手順

### 1. ジョブのステータスとログを確認する

まずDBのログを確認する。ジョブ失敗の root cause はほぼ `scraper_job_logs` に記録されている。

```ts
// check-logs.ts (scraper-worker ディレクトリで実行)
import { createDb } from "@open-gikai/db";
import { scraper_job_logs, scraper_jobs } from "@open-gikai/db/schema";
import { eq, desc } from "drizzle-orm";

const db = createDb(process.env.DATABASE_URL!);

const jobs = await db.select().from(scraper_jobs)
  .orderBy(desc(scraper_jobs.createdAt)).limit(3);

for (const job of jobs) {
  console.log(`Job: ${job.id} | ${job.status} | ${job.source}`);
  if (job.errorMessage) console.log("  error:", job.errorMessage);
  const logs = await db.select().from(scraper_job_logs)
    .where(eq(scraper_job_logs.jobId, job.id));
  for (const log of logs) console.log(`  [${log.level}] ${log.message}`);
}
```

### 2. テストジョブを作成して実行する

```ts
// scraper-worker ディレクトリで実行
import { createDb } from "@open-gikai/db";
import { scraper_jobs } from "@open-gikai/db/schema";
import { eq } from "drizzle-orm";
import { handleStartJob } from "./src/handlers/start-job";
import { handleNdlPage } from "./src/handlers/ndl";
import type { ScraperQueueMessage } from "./src/utils/types";

const db = createDb(process.env.DATABASE_URL!);

class MockQueue {
  messages: ScraperQueueMessage[] = [];
  async send(msg: ScraperQueueMessage) { this.messages.push(msg); }
  async sendBatch(msgs: Iterable<{ body: ScraperQueueMessage }>) {
    for (const m of msgs) this.messages.push(m.body);
  }
}

const [job] = await db.insert(scraper_jobs).values({
  source: "ndl",
  config: { from: "2024-01-15", until: "2024-01-31", limit: 5 },
}).returning();

const q = new MockQueue();
await handleStartJob(db, q as unknown as Queue<ScraperQueueMessage>, job!.id);

const ndlMsg = q.messages[0];
if (ndlMsg?.type === "ndl-page") {
  q.messages = [];
  await handleNdlPage(db, q as unknown as Queue<ScraperQueueMessage>, ndlMsg);
}

const [updated] = await db.select().from(scraper_jobs)
  .where(eq(scraper_jobs.id, job!.id)).limit(1);
console.log("status:", updated?.status, "inserted:", updated?.totalInserted);
```

### 3. 外部APIを直接テストする

`fetchPage` はエラーを握り潰して `null` を返す実装のため、実際に何が起きているかはcurlで確認する。

```bash
# NDL meeting API テスト
curl -s "https://kokkai.ndl.go.jp/api/meeting?from=2024-01-15&until=2024-01-31&recordPacking=json&maximumRecords=10&startRecord=1" | python3 -m json.tool | head -30

# ステータスコードも確認
curl -sv "https://kokkai.ndl.go.jp/api/meeting?from=2024-01-15&until=2024-01-31&recordPacking=json&maximumRecords=100&startRecord=1" 2>&1 | grep "< HTTP"
```

---

## 既知のハマりポイント

### NDL API: エンドポイントごとに `maximumRecords` の上限が違う

| エンドポイント | maximumRecords 上限 |
|---|---|
| `/api/speech` | 100 |
| `/api/meeting` | **10** |

`maximumRecords` に範囲外の値を送ると HTTP 400 が返り、`fetchPage` は `null` を返す。
結果としてジョブは `"NDL API 取得失敗"` で failed になる。

**症状:** ジョブログに `[error] NDL: API からの取得に失敗しました` と出る。

**診断:** curl でエンドポイントを叩き、400 とエラーメッセージを確認する。

**対処:** `handlers/ndl.ts` の `maximumRecords` を対象エンドポイントの上限以下に設定する。

---

### `fetchPage` がエラーを握り潰す

```ts
// 現在の実装: res.ok=false でも catch でも null を返す
async function fetchPage(...): Promise<NdlApiResponse | null> {
  try {
    const res = await fetch(...);
    if (!res.ok) return null;   // ← ステータスコードもボディも捨てる
    return await res.json();
  } catch {
    return null;                // ← 例外内容も捨てる
  }
}
```

外部API変更や設定ミスで失敗しても、ログには `"NDL API 取得失敗"` としか出ない。
調査時は必ず curl で直接叩いて HTTP レスポンスを目視確認する。

---

### `scraper_jobs.status` のライフサイクル

```
pending → queued (scheduled cronが投入時)
         → running (start-job handler開始時)
         → completed | failed (各handler終了時)
         → cancelled (GUI操作)
```

`queued` のまま止まっている場合はworkerが起動していない（ローカルでは cron が動かない）。
ローカルでは `local-runner.ts` を手動実行する。

---

## ローカル実行コマンド

```bash
# scraper-worker ディレクトリで
bun --env-file ../web/.env src/utils/local-runner.ts
```

`DATABASE_URL` が `apps/web/.env` に定義されている前提。
`OPENAI_API_KEY` があれば embedding も生成される。
