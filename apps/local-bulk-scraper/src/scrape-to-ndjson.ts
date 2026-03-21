/**
 * ローカル一括スクレイピング → NDJSON 出力スクリプト
 *
 * 全 enabled 自治体をスクレイピングし、meetings / statements / statement_chunks
 * の3つの NDJSON ファイルを出力する。
 *
 * 使い方:
 *   bun run scrape:ndjson
 *   bun run scrape:ndjson -- --year 2025
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@open-gikai/db";
import { municipalities, system_types } from "@open-gikai/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import dotenv from "dotenv";
import type { MeetingData } from "@open-gikai/scrapers";

import { scrapeAll as scrapeDbsearch } from "./bulk-scrapers/dbsearch";
import { scrapeAll as scrapeDiscussnetSsp } from "./bulk-scrapers/discussnet-ssp";
import { scrapeAll as scrapeKensakusystem } from "./bulk-scrapers/kensakusystem";
import { scrapeAll as scrapeGijirokuCom } from "./bulk-scrapers/gijiroku-com";
import { buildChunksFromStatements } from "@open-gikai/scrapers/statement-chunking";

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
  } catch {
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

async function main() {
  const targetYear = parseYear();
  if (targetYear) {
    console.log(`[scrape-to-ndjson] ${targetYear}年を対象にスクレイピングします`);
  }
  console.log("[scrape-to-ndjson] Starting...");

  // 1. DB から enabled な municipalities + system_types を取得
  const targets = await db
    .select({
      id: municipalities.id,
      name: municipalities.name,
      prefecture: municipalities.prefecture,
      baseUrl: municipalities.baseUrl,
      systemTypeName: system_types.name,
    })
    .from(municipalities)
    .leftJoin(system_types, eq(municipalities.systemTypeId, system_types.id))
    .where(and(eq(municipalities.enabled, true)));

  const enabledTargets = targets.filter((t) => t.baseUrl && t.systemTypeName);

  console.log(
    `[scrape-to-ndjson] ${enabledTargets.length} 自治体を処理します`
  );

  // 2. 出力ディレクトリの準備
  const today = new Date().toISOString().slice(0, 10);
  const outputDir = resolve(
    fileURLToPath(import.meta.url),
    "../../output",
    today
  );
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

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

  // 3. 自治体ごとにスクレイピング
  for (const target of enabledTargets) {
    console.log(
      `\n[scrape-to-ndjson] ${target.prefecture} ${target.name} (${target.systemTypeName})`
    );

    let meetingDataList: MeetingData[];
    try {
      meetingDataList = await scrapeMunicipality(
        target.id,
        target.name,
        target.baseUrl!,
        target.systemTypeName!,
        targetYear
      );
    } catch (err) {
      console.error(`  [ERROR] ${target.name}: スクレイピング失敗:`, err);
      continue;
    }

    if (meetingDataList.length === 0) {
      console.log(`  ${target.name}: 0 件`);
      continue;
    }

    console.log(
      `  ${target.name}: ${meetingDataList.length} 件の会議を処理中...`
    );

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
  }

  // ストリームを閉じる
  await Promise.all([
    new Promise<void>((resolve) => meetingsStream.end(resolve)),
    new Promise<void>((resolve) => statementsStream.end(resolve)),
    new Promise<void>((resolve) => chunksStream.end(resolve)),
  ]);

  console.log(`\n[scrape-to-ndjson] 完了!`);
  console.log(`  出力先: ${outputDir}`);
  console.log(`  meetings: ${totalMeetings} 件`);
  console.log(`  statements: ${totalStatements} 件`);
  console.log(`  statement_chunks: ${totalChunks} 件`);

  process.exit(0);
}

async function scrapeMunicipality(
  municipalityId: string,
  municipalityName: string,
  baseUrl: string,
  systemTypeName: string,
  targetYear?: number
): Promise<MeetingData[]> {
  switch (systemTypeName) {
    case "dbsearch":
      return scrapeDbsearch(municipalityId, municipalityName, baseUrl, targetYear);
    case "discussnet_ssp":
      return scrapeDiscussnetSsp(municipalityId, municipalityName, baseUrl, targetYear);
    case "kensakusystem":
      return scrapeKensakusystem(municipalityId, municipalityName, baseUrl, targetYear);
    case "gijiroku_com":
      return scrapeGijirokuCom(municipalityId, municipalityName, baseUrl, targetYear);
    default:
      console.warn(`  未対応の systemType: ${systemTypeName}`);
      return [];
  }
}

main().catch((err) => {
  console.error("[scrape-to-ndjson] Fatal error:", err);
  process.exit(1);
});
