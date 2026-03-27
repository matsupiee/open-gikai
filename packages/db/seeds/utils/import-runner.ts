import { createReadStream, existsSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline";
import type { Db } from "../../src/index";
import { municipalities } from "../../src/schema/municipalities";
import { meetings } from "../../src/schema/meetings";
import { statements } from "../../src/schema/statements";
import { parseMeetingNdjsonLine, type MeetingNdjsonRow } from "../parse-data/meetings";
import { parseStatementNdjsonLine, type StatementNdjsonRow } from "../parse-data/statements";
import { parseMunicipalitiesCsv } from "../parse-data/municipalities";
import { markAsImported } from "./complete-marker";
import type { ImportTarget } from "./collect-import-targets";

const BATCH_SIZE = 100;

export interface ImportAllOptions {
  municipalitiesCsvPath: string | null;
  markImported: boolean;
}

export interface ImportAllResult {
  totalDirs: number;
  failedDirs: number;
}

export async function importAll(
  db: Db,
  targets: ImportTarget[],
  dataDir: string,
  options: ImportAllOptions,
): Promise<ImportAllResult> {
  // municipalities（FK 制約を満たすため先にインサート）
  if (options.municipalitiesCsvPath) {
    console.log("[import] municipalities.csv を読み込み中...");
    const municipalityRows = parseMunicipalitiesCsv(options.municipalitiesCsvPath);

    for (let i = 0; i < municipalityRows.length; i += BATCH_SIZE) {
      const chunk = municipalityRows.slice(i, i + BATCH_SIZE);
      await db.insert(municipalities).values(chunk).onConflictDoNothing();
    }
    console.log(`[import] ${municipalityRows.length} 自治体 INSERT 完了`);
  }

  let totalDirs = 0;
  let failedDirs = 0;

  for (const target of targets) {
    const label = target.codeDir.replace(dataDir + "/", "");
    try {
      await importDirectory(db, target.meetingsPath, target.statementsPath, label);
      if (options.markImported) {
        markAsImported(target.codeDir);
      }
      totalDirs++;
      if (options.markImported) {
        console.log(`[import] ${label} インポート完了・フラグ記録`);
      } else {
        console.log(`[import] ${label} インポート完了`);
      }
    } catch (err) {
      failedDirs++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[import] ${label} 失敗: ${msg.slice(0, 300)}`);
    }
  }

  return { totalDirs, failedDirs };
}

async function importDirectory(
  db: Db,
  meetingsPath: string,
  statementsPath: string | null,
  label: string,
): Promise<void> {
  // ── バリデーションフェーズ ──
  // meetings.ndjson を読み込み
  const meetingRows: MeetingNdjsonRow[] = [];
  const allKnownMeetingIds = new Set<string>();

  for await (const line of createInterface({
    input: createReadStream(meetingsPath),
    crlfDelay: Infinity,
  })) {
    const m = parseMeetingNdjsonLine(line);
    if (!m) continue;
    allKnownMeetingIds.add(m.id);
    if (!m.heldOn) continue;
    meetingRows.push(m);
  }

  // statements.ndjson を読み込み + meetingId の整合性チェック
  const statementRows: StatementNdjsonRow[] = [];
  const insertableMeetingIds = new Set(meetingRows.map((m) => m.id));

  if (statementsPath) {
    for await (const line of createInterface({
      input: createReadStream(statementsPath),
      crlfDelay: Infinity,
    })) {
      const s = parseStatementNdjsonLine(line);
      if (!s) continue;
      if (!allKnownMeetingIds.has(s.meetingId)) {
        // meetings.ndjson に存在しない meetingId → データ不整合
        console.log(`[import]   ${label}: 存在しない meetingId を検出 → NDJSON 削除`);
        unlinkSync(statementsPath);
        if (existsSync(meetingsPath)) unlinkSync(meetingsPath);
        return;
      }
      if (!insertableMeetingIds.has(s.meetingId)) continue; // heldOn が null の会議に紐づく発言はスキップ
      statementRows.push(s);
    }
  }

  // ── INSERT フェーズ（バリデーション通過後のみ実行） ──
  // meetings INSERT
  for (let i = 0; i < meetingRows.length; i += BATCH_SIZE) {
    const chunk = meetingRows.slice(i, i + BATCH_SIZE);
    await insertMeetings(db, chunk);
  }

  // statements INSERT
  for (let i = 0; i < statementRows.length; i += BATCH_SIZE) {
    const chunk = statementRows.slice(i, i + BATCH_SIZE);
    await insertStatements(db, chunk);
  }

  console.log(`[import]   ${label}: ${meetingRows.length} 会議, ${statementRows.length} 発言`);
}

async function insertMeetings(db: Db, rows: MeetingNdjsonRow[]): Promise<string[]> {
  const result = await db
    .insert(meetings)
    .values(
      rows.map((m) => ({
        id: m.id,
        municipalityCode: m.municipalityCode,
        title: m.title,
        meetingType: m.meetingType,
        heldOn: m.heldOn,
        sourceUrl: m.sourceUrl ?? null,
        externalId: m.externalId ?? null,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: meetings.id });
  return result.map((r) => r.id);
}

async function insertStatements(db: Db, rows: StatementNdjsonRow[]): Promise<void> {
  await db
    .insert(statements)
    .values(
      rows.map((s) => ({
        id: s.id,
        meetingId: s.meetingId,
        kind: s.kind,
        speakerName: s.speakerName ?? null,
        speakerRole: s.speakerRole ?? null,
        content: s.content,
        contentHash: s.contentHash,
        startOffset: s.startOffset ?? null,
        endOffset: s.endOffset ?? null,
      })),
    )
    .onConflictDoNothing();
}
