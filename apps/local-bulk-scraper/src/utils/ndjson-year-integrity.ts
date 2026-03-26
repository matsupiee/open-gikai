import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

export interface YearNdjsonIntegrityResult {
  complete: boolean;
  /** complete が false のときの理由（ログ用） */
  reason?: string;
}

async function* ndjsonLines(
  filePath: string,
): AsyncGenerator<{ lineNo: number; line: string }, void, undefined> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    if (!line.trim()) continue;
    yield { lineNo, line: line.trimEnd() };
  }
}

/**
 * `{year}/{municipalityCode}/` 直下の meetings.ndjson / statements.ndjson を読み、
 * 各会議 id に対して少なくとも1件の statement（同一 meetingId）があるか検証する。
 */
export async function checkYearNdjsonIntegrity(yearDir: string): Promise<YearNdjsonIntegrityResult> {
  const completePath = resolve(yearDir, "_complete");
  if (!existsSync(completePath)) {
    return { complete: false, reason: "_complete マーカーがありません（前回のスクレイプが中断された可能性）" };
  }

  const meetingsPath = resolve(yearDir, "meetings.ndjson");
  const statementsPath = resolve(yearDir, "statements.ndjson");

  if (!existsSync(meetingsPath)) {
    return { complete: false, reason: "meetings.ndjson がありません" };
  }
  if (!existsSync(statementsPath)) {
    return { complete: false, reason: "statements.ndjson がありません" };
  }

  const meetingIds: string[] = [];
  try {
    for await (const { lineNo, line } of ndjsonLines(meetingsPath)) {
      let row: unknown;
      try {
        row = JSON.parse(line);
      } catch {
        return { complete: false, reason: `meetings.ndjson ${lineNo} 行目: JSON が不正です` };
      }
      if (!row || typeof row !== "object") {
        return { complete: false, reason: `meetings.ndjson ${lineNo} 行目: オブジェクトではありません` };
      }
      const id = (row as { id?: unknown }).id;
      if (typeof id !== "string" || id.length === 0) {
        return { complete: false, reason: `meetings.ndjson ${lineNo} 行目: id が不正です` };
      }
      meetingIds.push(id);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { complete: false, reason: `meetings.ndjson の読み取りに失敗: ${msg}` };
  }

  if (meetingIds.length === 0) {
    return { complete: false, reason: "meetings.ndjson に会議行がありません" };
  }

  const statementMeetingIds = new Set<string>();
  try {
    for await (const { lineNo, line } of ndjsonLines(statementsPath)) {
      let row: unknown;
      try {
        row = JSON.parse(line);
      } catch {
        return { complete: false, reason: `statements.ndjson ${lineNo} 行目: JSON が不正です` };
      }
      if (!row || typeof row !== "object") {
        return { complete: false, reason: `statements.ndjson ${lineNo} 行目: オブジェクトではありません` };
      }
      const meetingId = (row as { meetingId?: unknown }).meetingId;
      if (typeof meetingId !== "string" || meetingId.length === 0) {
        return { complete: false, reason: `statements.ndjson ${lineNo} 行目: meetingId が不正です` };
      }
      statementMeetingIds.add(meetingId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { complete: false, reason: `statements.ndjson の読み取りに失敗: ${msg}` };
  }

  const missing = meetingIds.filter((id) => !statementMeetingIds.has(id));
  if (missing.length > 0) {
    const sample = missing.slice(0, 3).join(", ");
    const suffix = missing.length > 3 ? "…" : "";
    return {
      complete: false,
      reason: `発言0件の会議が ${missing.length} 件（meeting id 例: ${sample}${suffix}）`,
    };
  }

  return { complete: true };
}
