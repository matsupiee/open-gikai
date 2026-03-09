import type { MeetingData } from "../types";

interface NdlOptions {
  from: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
  limit?: number; // max records to fetch (for testing)
}

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

/**
 * Delay execution for specified milliseconds
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch speeches from NDL API with pagination
 */
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

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`NDL API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as NdlApiResponse;
    return data;
  } catch (error) {
    console.error("Failed to fetch from NDL API:", error);
    return null;
  }
}

/**
 * Convert NDL speech record to MeetingData
 */
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
 * Scrape meetings from NDL (National Diet Library) API.
 * Returns all fetched records as MeetingData array.
 */
export async function scrapeNdl(options: NdlOptions): Promise<MeetingData[]> {
  const { from, until, limit } = options;
  console.log(`\n[NDL Scraper] Starting NDL scrape from ${from} to ${until}`);
  if (limit !== undefined) {
    console.log(`[NDL Scraper] Limit: ${limit} records`);
  }

  let startRecord = 1;
  const results: MeetingData[] = [];

  try {
    while (true) {
      console.log(`[NDL] Fetching records starting at ${startRecord}...`);

      const response = await fetchNdlSpeech(from, until, startRecord);

      if (!response) {
        console.error("[NDL] Failed to fetch speeches, stopping");
        break;
      }

      if (!response.speechRecord || response.speechRecord.length === 0) {
        console.log("[NDL] No more records to fetch");
        break;
      }

      // Apply limit: slice records if we would exceed the cap
      const remaining = limit !== undefined ? limit - results.length : undefined;
      const records =
        remaining !== undefined
          ? response.speechRecord.slice(0, remaining)
          : response.speechRecord;

      results.push(...records.map(convertNdlToMeeting));
      console.log(`[NDL] Fetched ${records.length} records (total: ${results.length})`);

      // Stop if limit reached
      if (limit !== undefined && results.length >= limit) {
        console.log(`[NDL] Limit of ${limit} records reached, stopping`);
        break;
      }

      // Check if there are more records
      if (!response.nextRecordPosition) {
        console.log("[NDL] All records processed");
        break;
      }

      startRecord = response.nextRecordPosition;

      // Delay to avoid overwhelming the API
      await delay(500);
    }

    console.log(`[NDL Scraper] Complete: Fetched ${results.length} total records`);
    return results;
  } catch (error) {
    console.error("[NDL Scraper] Error during scraping:", error);
    throw error;
  }
}
