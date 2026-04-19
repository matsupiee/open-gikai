import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { eq } from "drizzle-orm";
import type { Db } from "../../src/index";
import { meetings } from "../../src/schema/meetings";
import { parseSummaryNdjsonLine, type SummaryNdjsonRow } from "../parse-data/summaries";
import { markSummariesAsImported } from "./complete-marker";
import type { SummaryImportTarget } from "./collect-summary-import-targets";

export interface ImportSummariesOptions {
  markImported: boolean;
}

export interface ImportSummariesResult {
  totalDirs: number;
  failedDirs: number;
  totalUpdated: number;
}

export async function importAllSummaries(
  db: Db,
  targets: SummaryImportTarget[],
  dataDir: string,
  options: ImportSummariesOptions,
): Promise<ImportSummariesResult> {
  let totalDirs = 0;
  let failedDirs = 0;
  let totalUpdated = 0;

  for (const target of targets) {
    const label = target.codeDir.replace(dataDir + "/", "");
    try {
      const updated = await importSummariesDirectory(db, target.summariesPath, label);
      if (options.markImported) {
        markSummariesAsImported(target.codeDir);
      }
      totalDirs++;
      totalUpdated += updated;
      if (options.markImported) {
        console.log(`[import:summaries] ${label} ${updated} 件 UPDATE 完了・フラグ記録`);
      } else {
        console.log(`[import:summaries] ${label} ${updated} 件 UPDATE 完了`);
      }
    } catch (err) {
      failedDirs++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[import:summaries] ${label} 失敗: ${msg.slice(0, 300)}`);
    }
  }

  return { totalDirs, failedDirs, totalUpdated };
}

async function importSummariesDirectory(
  db: Db,
  summariesPath: string,
  label: string,
): Promise<number> {
  // ── バリデーションフェーズ ──
  const rows: SummaryNdjsonRow[] = [];
  let lineNo = 0;
  for await (const line of createInterface({
    input: createReadStream(summariesPath),
    crlfDelay: Infinity,
  })) {
    lineNo++;
    const row = parseSummaryNdjsonLine(line);
    if (!row) continue;
    if (!row.meetingId) {
      throw new Error(`summaries.ndjson L${lineNo}: meetingId が未設定`);
    }
    if (typeof row.summary !== "string" || row.summary.length === 0) {
      throw new Error(`summaries.ndjson L${lineNo} (meetingId=${row.meetingId}): summary が空`);
    }
    if (!Array.isArray(row.topicDigests)) {
      throw new Error(
        `summaries.ndjson L${lineNo} (meetingId=${row.meetingId}): topicDigests が配列でない`,
      );
    }
    rows.push(row);
  }

  // 同一 meetingId が複数行ある場合、最後の行が勝つ
  const dedup = new Map<string, SummaryNdjsonRow>();
  for (const row of rows) {
    dedup.set(row.meetingId, row);
  }

  // ── UPDATE フェーズ（バリデーション通過後のみ実行） ──
  let updated = 0;
  for (const row of dedup.values()) {
    const result = await db
      .update(meetings)
      .set({
        summary: row.summary,
        topicDigests: row.topicDigests,
        summaryGeneratedAt: new Date(row.summaryGeneratedAt),
        summaryModel: row.summaryModel,
      })
      .where(eq(meetings.id, row.meetingId))
      .returning({ id: meetings.id });
    if (result.length > 0) {
      updated++;
    } else {
      console.warn(
        `[import:summaries]   ${label}: meetingId=${row.meetingId} に対応する meetings 行なし（skip）`,
      );
    }
  }

  return updated;
}
