/**
 * ローカル一括スクレイピング → NDJSON 出力スクリプト
 *
 * 全 enabled 自治体をスクレイピングし、meetings / statements / statement_chunks
 * の3つの NDJSON ファイルを出力する。
 *
 * 使い方:
 *   bun run scrape:ndjson
 *   bun run scrape:ndjson -- --year 2025
 *   bun run scrape:ndjson -- --system-type dbsearch
 *   bun run scrape:ndjson -- --year 2025 --system-type discussnet_ssp
 *   bun run scrape:ndjson -- --system-type kensakusystem --meeting-limit 2
 *   bun run scrape:ndjson -- --target 011002,012025
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@open-gikai/db";
import { municipalities, system_types } from "@open-gikai/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, inArray } from "drizzle-orm";
import dotenv from "dotenv";
import type { MeetingData, ScraperAdapter } from "@open-gikai/scrapers";
import { getAdapter, initAdapterRegistry, buildChunksFromStatements } from "@open-gikai/scrapers";
import type { SystemType } from "@open-gikai/db/schema";

const EMBEDDING_BATCH_SIZE = 20;

// --- Setup ---

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const db = createDb(process.env.DATABASE_URL!);

async function generateEmbeddingsBatch(
  texts: string[],
  openaiApiKey: string
): Promise<(number[] | null)[]> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        input: texts.map((t) => t.slice(0, 8000)),
        model: "text-embedding-3-small",
      }),
    });
    if (!res.ok) return texts.map(() => null);
    const data = (await res.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    const result: (number[] | null)[] = texts.map(() => null);
    for (const item of data.data) {
      result[item.index] = item.embedding;
    }
    return result;
  } catch (err) {
    console.warn(`[embeddings] batch failed:`, err instanceof Error ? err.message : err);
    return texts.map(() => null);
  }
}

function parseYear(): number | undefined {
  const idx = process.argv.indexOf("--year");
  if (idx === -1) return undefined;
  const val = Number(process.argv[idx + 1]);
  if (Number.isNaN(val) || val < 2000 || val > 2100) {
    console.error(`[scrape-to-ndjson] 無効な年: ${process.argv[idx + 1]}`);
    process.exit(1);
  }
  return val;
}

function parseMeetingLimit(): number | undefined {
  const idx = process.argv.indexOf("--meeting-limit");
  if (idx === -1) return undefined;
  const val = Number(process.argv[idx + 1]);
  if (Number.isNaN(val) || val < 1) {
    console.error(`[scrape-to-ndjson] 無効な meeting-limit: ${process.argv[idx + 1]}`);
    process.exit(1);
  }
  return val;
}

const VALID_SYSTEM_TYPES: SystemType[] = ["discussnet_ssp", "dbsearch", "kensakusystem", "gijiroku_com"];

function parseTarget(): string[] | undefined {
  const idx = process.argv.indexOf("--target");
  if (idx === -1) return undefined;
  const val = process.argv[idx + 1];
  if (!val) {
    console.error(`[scrape-to-ndjson] --target に自治体コードを指定してください（カンマ区切りで複数指定可）`);
    process.exit(1);
  }
  return val.split(",").map((s) => s.trim());
}

function parseSystemType(): SystemType | undefined {
  const idx = process.argv.indexOf("--system-type");
  if (idx === -1) return undefined;
  const val = process.argv[idx + 1];
  if (!val || !VALID_SYSTEM_TYPES.includes(val as SystemType)) {
    console.error(`[scrape-to-ndjson] 無効なシステムタイプ: ${val}`);
    console.error(`  有効な値: ${VALID_SYSTEM_TYPES.join(", ")}`);
    process.exit(1);
  }
  return val as SystemType;
}

// 同一ホスト内の並列数。SaaS系サーバーへの過負荷を避けつつ高速化するため 3 に設定。
const HOST_CONCURRENCY = 3;

/**
 * ホスト名からグループ化キーを抽出する。
 *
 * dbsr.jp のように複数の自治体がサブドメイン違いで同一サーバーを共有している
 * SaaS 型システムでは、フルホスト名ではなくサービスドメイン単位でグループ化する。
 * これにより同一サーバーへの過負荷を防ぐ。
 */
const SHARED_SERVICE_DOMAINS = new Set([
  "dbsr.jp",
  "kaigiroku.net",
  "kensakusystem.jp",
  "gijiroku.com",
]);

function extractGroupKey(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  const last2 = parts.slice(-2).join(".");
  if (SHARED_SERVICE_DOMAINS.has(last2)) return last2;
  return hostname;
}

/**
 * タスクをサーバー単位でグループ化し、同一サーバーは HOST_CONCURRENCY 並列・サーバー間は並列で実行する。
 *
 * dbsr.jp (*.dbsr.jp)、discussnet-ssp (ssp.kaigiroku.net)、kensakusystem (*.kensakusystem.jp) のように
 * 複数自治体が同一サーバーを共有するシステムでは、並列数を抑えて IP 制限を回避する。
 */
function runGroupedByHost(
  targets: { baseUrl: string | null }[],
  tasks: (() => Promise<void>)[]
): Promise<void> {
  const hostGroups = new Map<string, (() => Promise<void>)[]>();

  for (let i = 0; i < targets.length; i++) {
    const host = extractGroupKey(new URL(targets[i]!.baseUrl!).hostname);
    if (!hostGroups.has(host)) hostGroups.set(host, []);
    hostGroups.get(host)!.push(tasks[i]!);
  }

  const hostTasks = [...hostGroups.values()].map((groupTasks) => async () => {
    const executing = new Set<Promise<void>>();
    for (const task of groupTasks) {
      const p: Promise<void> = task().finally(() => executing.delete(p));
      executing.add(p);
      if (executing.size >= HOST_CONCURRENCY) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  });

  return Promise.all(hostTasks.map((t) => t())).then(() => undefined);
}

async function main() {
  await initAdapterRegistry();
  const targetYear = parseYear();
  const targetSystemType = parseSystemType();
  const targetCodes = parseTarget();
  const meetingLimit = parseMeetingLimit();

  // 1. 出力ディレクトリの準備（ログ記録のため最初に作成）
  const today = new Date().toISOString().slice(0, 10);
  const outputDir = resolve(
    fileURLToPath(import.meta.url),
    "../../output",
    today
  );
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const runTimestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const logStream = createWriteStream(
    resolve(outputDir, `scrape-${runTimestamp}.log`)
  );

  const log = (level: "INFO" | "WARN" | "ERROR", ...args: unknown[]) => {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${args.map(String).join(" ")}`;
    if (level === "ERROR") {
      console.error(line);
    } else if (level === "WARN") {
      console.warn(line);
    } else {
      console.log(line);
    }
    logStream.write(line + "\n");
  };

  if (targetYear) {
    log("INFO", `[scrape-to-ndjson] ${targetYear}年を対象にスクレイピングします`);
  }
  if (targetSystemType) {
    log("INFO", `[scrape-to-ndjson] システムタイプ: ${targetSystemType} のみ対象`);
  }
  if (meetingLimit) {
    log("INFO", `[scrape-to-ndjson] meeting 数制限: 各自治体 ${meetingLimit} 件まで`);
  }
  if (targetCodes) {
    log("INFO", `[scrape-to-ndjson] 対象自治体コード: ${targetCodes.join(", ")}`);
  }
  log("INFO", "[scrape-to-ndjson] Starting...");

  // 2. DB から enabled な municipalities + system_types を取得
  const conditions = [eq(municipalities.enabled, true)];
  if (targetCodes) {
    conditions.push(inArray(municipalities.code, targetCodes));
  }
  const targets = await db
    .select({
      id: municipalities.id,
      code: municipalities.code,
      name: municipalities.name,
      prefecture: municipalities.prefecture,
      baseUrl: municipalities.baseUrl,
      systemTypeName: system_types.name,
    })
    .from(municipalities)
    .leftJoin(system_types, eq(municipalities.systemTypeId, system_types.id))
    .where(and(...conditions));

  const enabledTargets = targets.filter((t) => {
    if (!t.baseUrl) return false;
    // systemTypeName またはカスタムアダプター（自治体コード）のいずれかで adapter が見つかる必要がある
    if (!t.systemTypeName && !getAdapter(t.code)) return false;
    if (targetSystemType && t.systemTypeName !== targetSystemType) return false;
    return true;
  });

  log("INFO", `[scrape-to-ndjson] ${enabledTargets.length} 自治体を処理します`);

  // 3. NDJSON 出力ストリームの準備
  const meetingsStream = createWriteStream(
    resolve(outputDir, "meetings.ndjson")
  );
  const statementsStream = createWriteStream(
    resolve(outputDir, "statements.ndjson")
  );
  const chunksStream = createWriteStream(
    resolve(outputDir, "statement_chunks.ndjson")
  );

  const openaiApiKey = process.env.OPENAI_API_KEY;
  let totalMeetings = 0;
  let totalStatements = 0;
  let totalChunks = 0;
  const failedMunicipalities: { name: string; prefecture: string; systemType: string; reason: string }[] = [];

  // 4. 自治体を並列スクレイピング
  const tasks = enabledTargets.map((target) => async () => {
    const adapterKey = target.systemTypeName ?? target.code;
    log("INFO", `[scrape-to-ndjson] ${target.prefecture} ${target.name} (${adapterKey})`);

    let meetingDataList: MeetingData[];
    try {
      meetingDataList = await scrapeMunicipality(
        target.id,
        target.name,
        target.code,
        target.baseUrl!,
        target.systemTypeName,
        targetYear,
        meetingLimit
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log("ERROR", `${target.name}: スクレイピング失敗: ${reason}`);
      failedMunicipalities.push({ name: target.name, prefecture: target.prefecture, systemType: adapterKey, reason });
      return;
    }

    if (meetingDataList.length === 0) {
      log("INFO", `${target.name}: 0 件`);
      failedMunicipalities.push({ name: target.name, prefecture: target.prefecture, systemType: adapterKey, reason: "0 件（データなし）" });
      return;
    }

    log("INFO", `${target.name}: ${meetingDataList.length} 件の会議を処理中...`);

    // 4. 各会議を NDJSON に書き出す
    for (const meetingData of meetingDataList) {
      const meetingId = createId();
      const now = new Date().toISOString();

      // meetings.ndjson
      meetingsStream.write(
        JSON.stringify({
          id: meetingId,
          municipalityId: meetingData.municipalityId,
          title: meetingData.title,
          meetingType: meetingData.meetingType,
          heldOn: meetingData.heldOn,
          sourceUrl: meetingData.sourceUrl,
          externalId: meetingData.externalId,
          status: "processed",
          scrapedAt: now,
        }) + "\n"
      );
      totalMeetings++;

      // statements の ID を生成
      const statementsWithIds = meetingData.statements.map((s) => ({
        id: createId(),
        meetingId,
        ...s,
      }));

      // statement_chunks の生成（statements より先に生成し、chunkId を紐付ける）
      const chunkInputs = buildChunksFromStatements(
        statementsWithIds.map((s) => ({
          id: s.id,
          speakerName: s.speakerName,
          speakerRole: s.speakerRole,
          content: s.content,
        }))
      );

      // chunk を生成し、statementId → chunkId のマッピングを構築
      const stmtToChunkId = new Map<string, string>();

      for (let i = 0; i < chunkInputs.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunkInputs.slice(i, i + EMBEDDING_BATCH_SIZE);

        let embeddings: (number[] | null)[] = batch.map(() => null);
        if (openaiApiKey) {
          embeddings = await generateEmbeddingsBatch(
            batch.map((c) => c.content),
            openaiApiKey
          );
        }

        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j]!;
          const chunkId = createId();
          const contentHash = createHash("sha256")
            .update(chunk.content)
            .digest("hex");

          // statementId → chunkId を記録
          for (const stmtId of chunk.statementIds) {
            stmtToChunkId.set(stmtId, chunkId);
          }

          chunksStream.write(
            JSON.stringify({
              id: chunkId,
              meetingId,
              speakerName: chunk.speakerName,
              speakerRole: chunk.speakerRole,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              contentHash,
              embedding: embeddings[j] ?? null,
            }) + "\n"
          );
          totalChunks++;
        }
      }

      // statements を NDJSON に書き出し（chunkId を紐付け済み）
      for (const s of statementsWithIds) {
        statementsStream.write(
          JSON.stringify({
            id: s.id,
            meetingId: s.meetingId,
            kind: s.kind,
            speakerName: s.speakerName,
            speakerRole: s.speakerRole,
            content: s.content,
            contentHash: s.contentHash,
            startOffset: s.startOffset,
            endOffset: s.endOffset,
            chunkId: stmtToChunkId.get(s.id) ?? null,
          }) + "\n"
        );
        totalStatements++;
      }
    }
  });

  await runGroupedByHost(enabledTargets, tasks);

  // ストリームを閉じる
  await Promise.all([
    new Promise<void>((resolve) => meetingsStream.end(resolve)),
    new Promise<void>((resolve) => statementsStream.end(resolve)),
    new Promise<void>((resolve) => chunksStream.end(resolve)),
  ]);

  log("INFO", "[scrape-to-ndjson] 完了!");
  log("INFO", `  出力先: ${outputDir}`);
  log("INFO", `  meetings: ${totalMeetings} 件`);
  log("INFO", `  statements: ${totalStatements} 件`);
  log("INFO", `  statement_chunks: ${totalChunks} 件`);

  if (failedMunicipalities.length > 0) {
    log("INFO", "");
    log("INFO", `[scrape-to-ndjson] 失敗・0件の自治体: ${failedMunicipalities.length} 件`);
    const byType = new Map<string, number>();
    for (const f of failedMunicipalities) {
      byType.set(f.systemType, (byType.get(f.systemType) ?? 0) + 1);
    }
    for (const [type, count] of byType) {
      log("INFO", `  ${type}: ${count} 件`);
    }
    log("INFO", "");
    for (const f of failedMunicipalities) {
      log("INFO", `  [FAIL] ${f.prefecture} ${f.name} (${f.systemType}): ${f.reason}`);
    }
  }

  await new Promise<void>((resolve) => logStream.end(resolve));

  process.exit(0);
}

async function scrapeMunicipality(
  municipalityId: string,
  municipalityName: string,
  municipalityCode: string,
  baseUrl: string,
  systemTypeName: string | null,
  targetYear?: number,
  meetingLimit?: number
): Promise<MeetingData[]> {
  const adapter = (systemTypeName && getAdapter(systemTypeName)) || getAdapter(municipalityCode);
  if (adapter) {
    return scrapeWithAdapter(adapter, municipalityId, municipalityName, baseUrl, targetYear, meetingLimit);
  }

  console.warn(`  未対応の systemType: ${systemTypeName ?? "null"} (code=${municipalityCode})`);
  return [];
}

/**
 * ScraperAdapter を使った汎用バルクスクレイピング。
 * 指定年度（未指定時は直近5年）の議事録を取得する。
 */
async function scrapeWithAdapter(
  adapter: ScraperAdapter,
  municipalityId: string,
  municipalityName: string,
  baseUrl: string,
  targetYear?: number,
  meetingLimit?: number
): Promise<MeetingData[]> {
  const results: MeetingData[] = [];

  const currentYear = new Date().getFullYear();
  const years = targetYear
    ? [targetYear]
    : Array.from({ length: 5 }, (_, i) => currentYear - i);

  for (const year of years) {
    if (meetingLimit && results.length >= meetingLimit) break;

    console.log(
      `  [${adapter.name}] ${municipalityName}: ${year}年の一覧を取得中...`
    );

    const records = await adapter.fetchList({ baseUrl, year });
    if (records.length === 0) {
      console.log(`  [${adapter.name}] ${municipalityName}: ${year}年 → データなし`);
      continue;
    }

    const remaining = meetingLimit ? meetingLimit - results.length : records.length;
    const limited = records.slice(0, remaining);
    const limitNote = meetingLimit ? ` (${limited.length}/${records.length} 件処理)` : "";

    console.log(
      `  [${adapter.name}] ${municipalityName}: ${year}年 → ${records.length} 件${limitNote}`
    );

    for (const record of limited) {
      const meeting = await adapter.fetchDetail({
        detailParams: record.detailParams,
        municipalityId,
      });
      if (meeting) {
        results.push(meeting);
      }
    }
  }

  return results;
}

main().catch((err) => {
  console.error("[scrape-to-ndjson] Fatal error:", err);
  process.exit(1);
});
