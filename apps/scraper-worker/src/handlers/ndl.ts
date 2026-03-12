import type { Db } from "@open-gikai/db";
import { delay } from "../utils/delay";
import {
  addJobStats,
  createScraperJobLog,
  updateScraperJobStatus,
} from "../db/job-logger";
import type { ScraperQueueMessage } from "../utils/types";
import { saveMeetings } from "../db/save-meetings";

const NDL_BASE = "https://kokkai.ndl.go.jp/api/meeting";
const DELAY_MS = 500;

interface NdlSpeechRecord {
  speechID: string;
  speaker?: string;
  speech: string;
  speechURL: string;
}

interface NdlMeetingRecord {
  issueID: string;
  nameOfHouse: string;
  nameOfMeeting: string;
  date: string;
  meetingURL: string;
  speechRecord: NdlSpeechRecord[];
}

interface NdlApiResponse {
  numberOfRecords: number;
  numberOfReturn: number;
  startRecord: number;
  nextRecordPosition: number | null;
  meetingRecord: NdlMeetingRecord[];
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
    maximumRecords: "10",
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

  await createScraperJobLog(db, {
    jobId,
    level: "info",
    message: `NDL: レコード取得中 (開始位置: ${startRecord}, 累計: ${fetchedSoFar})`,
  });

  await delay(DELAY_MS);
  const response = await fetchPage(from, until, startRecord);

  if (!response) {
    await createScraperJobLog(db, {
      jobId,
      level: "error",
      message: "NDL: API からの取得に失敗しました",
    });
    await updateScraperJobStatus(db, jobId, "failed", {
      errorMessage: "NDL API 取得失敗",
    });
    return;
  }

  if (!response.meetingRecord || response.meetingRecord.length === 0) {
    await createScraperJobLog(db, {
      jobId,
      level: "info",
      message: "NDL: 全レコード処理完了",
    });
    await updateScraperJobStatus(db, jobId, "completed");
    return;
  }

  const remaining = limit === undefined ? undefined : limit - fetchedSoFar;
  const records =
    remaining === undefined
      ? response.meetingRecord
      : response.meetingRecord.slice(0, remaining);

  const meetings = records.map((r: NdlMeetingRecord) => ({
    title: `${r.nameOfHouse} ${r.nameOfMeeting}`,
    meetingType: "plenary" as const,
    heldOn: r.date,
    sourceUrl: r.meetingURL,
    assemblyLevel: "national" as const,
    prefecture: null,
    municipality: null,
    externalId: r.issueID,
    rawText: r.speechRecord.map((s) => s.speech).join("\n\n---\n\n"),
  }));

  const { inserted, skipped } = await saveMeetings(db, meetings);
  const newFetchedSoFar = fetchedSoFar + records.length;

  await addJobStats(db, jobId, inserted, skipped);
  await createScraperJobLog(db, {
    jobId,
    level: "info",
    message: `NDL: ${records.length} 件取得 (累計: ${newFetchedSoFar} 件, inserted=${inserted}, skipped=${skipped})`,
  });

  const reachedLimit = limit !== undefined && newFetchedSoFar >= limit;
  if (reachedLimit) {
    await createScraperJobLog(db, {
      jobId,
      level: "info",
      message: `NDL: 上限 ${limit} 件に達しました`,
    });
    await updateScraperJobStatus(db, jobId, "completed");
    return;
  }

  if (!response.nextRecordPosition) {
    await createScraperJobLog(db, {
      jobId,
      level: "info",
      message: "NDL: 全レコード処理完了",
    });
    await updateScraperJobStatus(db, jobId, "completed");
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
