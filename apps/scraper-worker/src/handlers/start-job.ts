import { eq } from "drizzle-orm";
import { scraper_jobs } from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import { createJobLogger, updateJobStatus } from "../db/job-logger";
import type {
  KagoshimaScraperConfig,
  LocalScraperConfig,
  NdlScraperConfig,
  ScraperQueueMessage,
} from "../utils/types";

const API_BASE = "https://ssp.kaigiroku.net/dnp/search";
const TENANT_ID = 539;

interface CouncilEntry {
  council_id: number;
  name: string;
}

interface CouncilTypeGroup {
  council_type_name1: string | null;
  council_type_name2: string | null;
  council_type_name3: string | null;
  councils: CouncilEntry[];
}

interface YearEntry {
  view_year: string;
  council_type: CouncilTypeGroup[];
}

interface CouncilsIndexResponse {
  councils: Array<{ view_years: YearEntry[] }>;
}

async function fetchKagoshimaCouncils(
  config: KagoshimaScraperConfig
): Promise<
  Array<{ councilId: number; councilName: string; typeGroupNames: string[] }>
> {
  const res = await fetch(`${API_BASE}/councils/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: TENANT_ID }),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as CouncilsIndexResponse;
  const viewYears = data.councils[0]?.view_years ?? [];
  const filtered = config.year
    ? viewYears.filter((vy) => Number(vy.view_year) === config.year)
    : viewYears;

  const result: Array<{
    councilId: number;
    councilName: string;
    typeGroupNames: string[];
  }> = [];
  for (const yearEntry of filtered) {
    for (const typeGroup of yearEntry.council_type) {
      const typeGroupNames = [
        typeGroup.council_type_name1,
        typeGroup.council_type_name2,
        typeGroup.council_type_name3,
      ].filter((n): n is string => n !== null);

      for (const council of typeGroup.councils) {
        result.push({
          councilId: council.council_id,
          councilName: council.name,
          typeGroupNames,
        });
      }
    }
  }

  return config.limit ? result.slice(0, config.limit) : result;
}

export async function handleStartJob(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  jobId: string
): Promise<void> {
  const logger = createJobLogger(db, jobId);

  const rows = await db
    .select()
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, jobId))
    .limit(1);

  const job = rows[0];
  if (!job) {
    console.error(`[start-job] Job not found: ${jobId}`);
    return;
  }

  if (job.status === "cancelled") {
    await logger("info", "ジョブがキャンセルされたため処理をスキップします");
    return;
  }

  if (job.status === "running" || job.status === "completed") {
    await logger("warn", `ジョブは既に処理済みのためスキップします: status=${job.status}`);
    return;
  }

  await updateJobStatus(db, jobId, "running");
  await logger("info", `ジョブ開始: source=${job.source}`);

  const config = job.config as Record<string, unknown>;

  if (job.source === "kagoshima") {
    const scraperConfig: KagoshimaScraperConfig = {
      year: config.year as number | undefined,
      limit: config.limit as number | undefined,
    };

    await logger("info", "鹿児島: 議会一覧を取得中...");
    const councils = await fetchKagoshimaCouncils(scraperConfig);

    if (councils.length === 0) {
      await logger("error", "鹿児島: 議会一覧の取得に失敗しました");
      await updateJobStatus(db, jobId, "failed", {
        errorMessage: "議会一覧の取得に失敗",
      });
      return;
    }

    await updateJobStatus(db, jobId, "running", {
      totalItems: councils.length,
    });
    await logger(
      "info",
      `鹿児島: ${councils.length} 件の議会セッションをキューに投入します`
    );

    for (const council of councils) {
      await queue.send({
        type: "kagoshima-council",
        jobId,
        councilId: council.councilId,
        councilName: council.councilName,
        typeGroupNames: council.typeGroupNames,
        remainingCouncils: councils.length,
      });
    }
  } else if (job.source === "ndl") {
    const scraperConfig: NdlScraperConfig = {
      from: config.from as string,
      until: config.until as string,
      limit: config.limit as number | undefined,
    };

    await logger(
      "info",
      `NDL: ページ 1 をキューに投入します (${scraperConfig.from} ～ ${scraperConfig.until})`
    );
    await queue.send({
      type: "ndl-page",
      jobId,
      from: scraperConfig.from,
      until: scraperConfig.until,
      startRecord: 1,
      limit: scraperConfig.limit,
      fetchedSoFar: 0,
    });
  } else if (job.source === "local") {
    const scraperConfig = config as unknown as LocalScraperConfig;
    const targets = scraperConfig.targets ?? [];

    await updateJobStatus(db, jobId, "running", { totalItems: targets.length });
    await logger(
      "info",
      `Local: ${targets.length} 件のターゲットをキューに投入します`
    );

    for (const target of targets) {
      await queue.send({
        type: "local-target",
        jobId,
        target,
        limit: scraperConfig.limit,
      });
    }
  } else {
    await logger("error", `不明なソース: ${job.source}`);
    await updateJobStatus(db, jobId, "failed", {
      errorMessage: `不明なソース: ${job.source}`,
    });
  }
}
