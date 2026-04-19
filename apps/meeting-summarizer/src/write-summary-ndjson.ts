import { mkdir, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { MeetingTopicDigest } from "@open-gikai/db/schema";

export type SummaryNdjsonRow = {
  meetingId: string;
  municipalityCode: string;
  heldOn: string;
  summary: string;
  topicDigests: MeetingTopicDigest[];
  summaryModel: string;
  summaryGeneratedAt: string;
};

let writeChain: Promise<void> = Promise.resolve();

/**
 * data/minutes/{year}/{municipalityCode}/summaries.ndjson に 1 行追記する。
 *
 * 並列 worker から呼ばれても行が壊れないよう、モジュールレベルで
 * Promise チェーンによる直列化を行う。
 */
export function appendSummaryRow(dataDir: string, row: SummaryNdjsonRow): Promise<void> {
  const year = row.heldOn.slice(0, 4);
  if (!/^\d{4}$/.test(year)) {
    return Promise.reject(new Error(`invalid heldOn for year extraction: ${row.heldOn}`));
  }
  const dir = resolve(dataDir, year, row.municipalityCode);
  const file = resolve(dir, "summaries.ndjson");
  const line = JSON.stringify(row) + "\n";

  const next = writeChain.then(async () => {
    await mkdir(dir, { recursive: true });
    await appendFile(file, line, "utf-8");
  });
  writeChain = next.catch(() => undefined);
  return next;
}
