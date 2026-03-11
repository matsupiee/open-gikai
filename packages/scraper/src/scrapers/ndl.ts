import type { MeetingData, Logger, NdlScraperConfig } from "../types";

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

async function fetchNdlSpeech(
  from: string,
  until: string,
  startRecord: number = 1
): Promise<NdlApiResponse | null> {
  const baseUrl = "https://kokkai.ndl.go.jp/api/speech";
  const params = new URLSearchParams({
    from,
    until,
    recordPacking: "json",
    maximumRecords: "100",
    startRecord: startRecord.toString(),
  });

  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`);
    if (!response.ok) return null;
    return (await response.json()) as NdlApiResponse;
  } catch {
    return null;
  }
}

function convertNdlToMeeting(record: NdlSpeechRecord): MeetingData {
  return {
    title: `${record.nameOfHouse} ${record.nameOfMeeting}`,
    meetingType: "plenary",
    heldOn: record.date,
    sourceUrl: record.speechURL,
    assemblyLevel: "national",
    prefecture: null,
    municipality: null,
    externalId: record.speechID,
    rawText: record.speech,
  };
}

/**
 * NDL（国立国会図書館）APIから国会議事録を取得する。
 * CFW 互換: fetch のみ使用。
 */
export async function scrapeNdl(
  config: NdlScraperConfig,
  logger: Logger
): Promise<MeetingData[]> {
  const { from, until, limit } = config;
  await logger("info", `NDL scrape 開始: ${from} ～ ${until}${limit ? ` (上限 ${limit} 件)` : ""}`);

  let startRecord = 1;
  const results: MeetingData[] = [];

  while (true) {
    await logger("info", `NDL: レコード取得中 (開始位置: ${startRecord})`);

    const response = await fetchNdlSpeech(from, until, startRecord);

    if (!response) {
      await logger("error", "NDL: API からの取得に失敗しました");
      break;
    }

    if (!response.speechRecord || response.speechRecord.length === 0) {
      await logger("info", "NDL: 取得完了（残レコードなし）");
      break;
    }

    const remaining = limit !== undefined ? limit - results.length : undefined;
    const records =
      remaining !== undefined
        ? response.speechRecord.slice(0, remaining)
        : response.speechRecord;

    results.push(...records.map(convertNdlToMeeting));
    await logger("info", `NDL: ${records.length} 件取得 (累計: ${results.length} 件)`);

    if (limit !== undefined && results.length >= limit) {
      await logger("info", `NDL: 上限 ${limit} 件に達しました`);
      break;
    }

    if (!response.nextRecordPosition) {
      await logger("info", "NDL: 全レコード処理完了");
      break;
    }

    startRecord = response.nextRecordPosition;
    await delay(500);
  }

  await logger("info", `NDL scrape 完了: 合計 ${results.length} 件`);
  return results;
}
