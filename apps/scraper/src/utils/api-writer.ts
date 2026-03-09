import type { MeetingData } from "../types";

const BATCH_SIZE = 100;

interface IngestResult {
  inserted: number;
  skipped: number;
}

interface ApiWriterConfig {
  apiUrl: string;
  apiKey: string;
}

async function postBatch(
  batch: MeetingData[],
  config: ApiWriterConfig
): Promise<IngestResult> {
  const response = await fetch(`${config.apiUrl}/api/ingest/meetings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify({ meetings: batch }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ingest API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<IngestResult>;
}

export async function writeApi(
  records: MeetingData[],
  config: ApiWriterConfig
): Promise<void> {
  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    console.log(`[API] Sending batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

    const result = await postBatch(batch, config);
    totalInserted += result.inserted;
    totalSkipped += result.skipped;

    console.log(`[API] Batch ${batchNum}: inserted=${result.inserted}, skipped=${result.skipped}`);
  }

  console.log(`\n[API] Done: inserted=${totalInserted}, skipped=${totalSkipped}`);
}
