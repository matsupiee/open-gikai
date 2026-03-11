import type { Db } from "../db";
import { addJobStats, createJobLogger, updateJobStatus } from "../job-logger";
import type { ScraperQueueMessage } from "../types";
import { saveMeetings } from "./save-meetings";

const NDL_BASE = "https://kokkai.ndl.go.jp/api/speech";
const DELAY_MS = 500;

interface NdlSpeechRecord {
  speechID: string;
  nameOfHouse: string;
  nameOfMeeting: string;
  date: string;
  speechURL: string;
  speech: string;
  speaker?: string;
}

interface NdlApiResponse {
  numberOfRecords: number;
  numberOfReturn: number;
  startRecord: number;
  nextRecordPosition: number | null;
  speechRecord: NdlSpeechRecord[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(
  from: string,
  until: string,
  startRecord: number
): Promise<NdlApiResponse | null> {
  const params = new URLSearchParams({
    from,
    until,
    recordPacking: "json",
    maximumRecords: "100",
    startRecord: startRecord.toString(),
  });

  try {
    const res = await fetch(`${NDL_BASE}?${params.toString()}`);
    if (!res.ok) return null;
    return (await res.json()) as NdlApiResponse;
  } catch {
    return null;
  }
}

type NdlPageMsg = Extract<ScraperQueueMessage, { type: "ndl-page" }>;

export async function handleNdlPage(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: NdlPageMsg
): Promise<void> {
  const { jobId, from, until, startRecord, limit, fetchedSoFar } = msg;
  const logger = createJobLogger(db, jobId);

  await logger("info", `NDL: レコード取得中 (開始位置: ${startRecord}, 累計: ${fetchedSoFar})`);

  await delay(DELAY_MS);
  const response = await fetchPage(from, until, startRecord);

  if (!response) {
    await logger("error", "NDL: API からの取得に失敗しました");
    await updateJobStatus(db, jobId, "failed", { errorMessage: "NDL API 取得失敗" });
    return;
  }

  if (!response.speechRecord || response.speechRecord.length === 0) {
    await logger("info", "NDL: 全レコード処理完了");
    await updateJobStatus(db, jobId, "completed");
    return;
  }

  const remaining = limit !== undefined ? limit - fetchedSoFar : undefined;
  const records = remaining !== undefined
    ? response.speechRecord.slice(0, remaining)
    : response.speechRecord;

  const meetings = records.map((r) => ({
    title: `${r.nameOfHouse} ${r.nameOfMeeting}`,
    meetingType: "plenary" as const,
    heldOn: r.date,
    sourceUrl: r.speechURL,
    assemblyLevel: "national" as const,
    prefecture: null,
    municipality: null,
    externalId: r.speechID,
    rawText: r.speech,
  }));

  const { inserted, skipped } = await saveMeetings(db, meetings);
  const newFetchedSoFar = fetchedSoFar + records.length;

  await addJobStats(db, jobId, inserted, skipped);
  await logger("info", `NDL: ${records.length} 件取得 (累計: ${newFetchedSoFar} 件, inserted=${inserted}, skipped=${skipped})`);

  const reachedLimit = limit !== undefined && newFetchedSoFar >= limit;
  if (reachedLimit) {
    await logger("info", `NDL: 上限 ${limit} 件に達しました`);
    await updateJobStatus(db, jobId, "completed");
    return;
  }

  if (!response.nextRecordPosition) {
    await logger("info", "NDL: 全レコード処理完了");
    await updateJobStatus(db, jobId, "completed");
    return;
  }

  // 次のページをキューに投入（セルフチェーン）
  await queue.send({
    type: "ndl-page",
    jobId,
    from,
    until,
    startRecord: response.nextRecordPosition,
    limit,
    fetchedSoFar: newFetchedSoFar,
  });
}
