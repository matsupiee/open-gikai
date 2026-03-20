/**
 * NDJSON → 本番 DB インポートスクリプト
 *
 * scrape-to-ndjson.ts が出力した NDJSON ファイルを読み込み、
 * meetings / statements / statement_chunks に INSERT する。
 *
 * 使い方:
 *   bun run import:ndjson                          # 最新の output ディレクトリを使用
 *   bun run import:ndjson -- --dir output/2024-01-15
 *   bun run import:ndjson -- --yes                 # 確認プロンプトをスキップ
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { createDb } from "@open-gikai/db";
import {
  meetings,
  statements,
  statement_chunks,
} from "@open-gikai/db/schema";
import { inArray } from "drizzle-orm";
import dotenv from "dotenv";

const INSERT_BATCH_SIZE = 500;

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

function parseArgs(): { dir?: string; yes: boolean } {
  const args = process.argv.slice(2);
  let dir: string | undefined;
  let yes = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) {
      dir = args[i + 1];
      i++;
    } else if (args[i] === "--yes") {
      yes = true;
    }
  }

  return { dir, yes };
}

function findLatestOutputDir(): string | null {
  const outputBase = resolve(fileURLToPath(import.meta.url), "../../output");
  if (!existsSync(outputBase)) return null;

  const dirs = readdirSync(outputBase, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();

  return dirs[0] ? resolve(outputBase, dirs[0]) : null;
}

function readNdjsonFile<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function main() {
  const { dir, yes } = parseArgs();

  const outputDir = dir
    ? resolve(process.cwd(), dir)
    : findLatestOutputDir();

  if (!outputDir || !existsSync(outputDir)) {
    console.error("[import-ndjson] 出力ディレクトリが見つかりません");
    process.exit(1);
  }

  console.log(`[import-ndjson] ディレクトリ: ${outputDir}`);

  // NDJSON ファイルを読み込み
  const meetingRecords = readNdjsonFile<Record<string, unknown>>(
    resolve(outputDir, "meetings.ndjson")
  );
  const statementRecords = readNdjsonFile<Record<string, unknown>>(
    resolve(outputDir, "statements.ndjson")
  );
  const chunkRecords = readNdjsonFile<Record<string, unknown>>(
    resolve(outputDir, "statement_chunks.ndjson")
  );

  console.log(`  meetings: ${meetingRecords.length} 件`);
  console.log(`  statements: ${statementRecords.length} 件`);
  console.log(`  statement_chunks: ${chunkRecords.length} 件`);

  if (meetingRecords.length === 0) {
    console.log("[import-ndjson] インポートするデータがありません");
    process.exit(0);
  }

  // 確認プロンプト
  if (!yes) {
    const ok = await confirm(
      "\nインポート対象の既存 meetings を DELETE してからインポートします。続行しますか?"
    );
    if (!ok) {
      console.log("[import-ndjson] キャンセルしました");
      process.exit(0);
    }
  }

  const db = createDb(process.env.DATABASE_URL!);

  const meetingIds = meetingRecords.map((r) => r.id as string);

  console.log("\n[import-ndjson] インポート開始...");

  // 既存データの削除（CASCADE で statements, statement_chunks も削除される）
  console.log("  既存 meetings を削除中...");
  for (let i = 0; i < meetingIds.length; i += INSERT_BATCH_SIZE) {
    const batch = meetingIds.slice(i, i + INSERT_BATCH_SIZE);
    await db.delete(meetings).where(inArray(meetings.id, batch));
  }

  // meetings の INSERT
  console.log("  meetings を INSERT 中...");
  for (let i = 0; i < meetingRecords.length; i += INSERT_BATCH_SIZE) {
    const batch = meetingRecords.slice(i, i + INSERT_BATCH_SIZE);
    await db
      .insert(meetings)
      .values(
        batch.map((r) => ({
          id: r.id as string,
          municipalityId: r.municipalityId as string,
          title: r.title as string,
          meetingType: r.meetingType as string,
          heldOn: r.heldOn as string,
          sourceUrl: (r.sourceUrl as string) ?? null,
          externalId: (r.externalId as string) ?? null,
          status: r.status as string,
          scrapedAt: r.scrapedAt ? new Date(r.scrapedAt as string) : null,
        }))
      )
      .onConflictDoNothing();
  }

  // statement_chunks の INSERT（statements より先。chunkId FK のため）
  console.log("  statement_chunks を INSERT 中...");
  for (let i = 0; i < chunkRecords.length; i += INSERT_BATCH_SIZE) {
    const batch = chunkRecords.slice(i, i + INSERT_BATCH_SIZE);
    await db
      .insert(statement_chunks)
      .values(
        batch.map((r) => ({
          id: r.id as string,
          meetingId: r.meetingId as string,
          speakerName: (r.speakerName as string) ?? null,
          speakerRole: (r.speakerRole as string) ?? null,
          chunkIndex: (r.chunkIndex as number) ?? 0,
          content: r.content as string,
          contentHash: r.contentHash as string,
          embedding: (r.embedding as number[]) ?? null,
        }))
      )
      .onConflictDoNothing();
  }

  // statements の INSERT
  console.log("  statements を INSERT 中...");
  for (let i = 0; i < statementRecords.length; i += INSERT_BATCH_SIZE) {
    const batch = statementRecords.slice(i, i + INSERT_BATCH_SIZE);
    await db
      .insert(statements)
      .values(
        batch.map((r) => ({
          id: r.id as string,
          meetingId: r.meetingId as string,
          kind: r.kind as string,
          speakerName: (r.speakerName as string) ?? null,
          speakerRole: (r.speakerRole as string) ?? null,
          content: r.content as string,
          contentHash: r.contentHash as string,
          startOffset: (r.startOffset as number) ?? null,
          endOffset: (r.endOffset as number) ?? null,
          chunkId: (r.chunkId as string) ?? null,
        }))
      )
      .onConflictDoNothing();
  }

  console.log("\n[import-ndjson] 完了!");
  console.log(`  meetings: ${meetingRecords.length} 件`);
  console.log(`  statements: ${statementRecords.length} 件`);
  console.log(`  statement_chunks: ${chunkRecords.length} 件`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[import-ndjson] Fatal error:", err);
  process.exit(1);
});
