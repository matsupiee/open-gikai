import {
  municipalities,
  scraper_jobs,
  system_types,
} from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import { createJobLogger, updateJobStatus } from "../utils/job-logger";
import type { ScraperQueueMessage } from "../utils/types";
import { getAdapter } from "../adapters/registry";

/**
 * pending ジョブを検証し、自治体の systemType に応じて最初のキューメッセージを投入する。
 * scheduled (Cron) または local-runner から呼ばれる。
 */
export async function dispatchJob(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  job: {
    scraper_jobs: typeof scraper_jobs.$inferSelect;
    municipalities: typeof municipalities.$inferSelect;
    system_types: typeof system_types.$inferSelect | null;
  }
): Promise<void> {
  const { scraper_jobs, municipalities, system_types: systemType } = job;
  const logger = createJobLogger(db, scraper_jobs.id);

  await updateJobStatus(db, scraper_jobs.id, "running");
  await logger.info(
    `ジョブ開始: municipality=${municipalities.name} systemType=${
      systemType?.name ?? "未設定"
    }`
  );

  if (!municipalities.baseUrl) {
    await logger.error(
      `baseUrl が未設定: municipalityId=${scraper_jobs.municipalityId}`
    );
    await updateJobStatus(db, scraper_jobs.id, "failed", {
      errorMessage: `baseUrl が未設定: municipalityId=${scraper_jobs.municipalityId}`,
    });
    return;
  }

  const adapterName = systemType?.name;
  if (!adapterName || !getAdapter(adapterName)) {
    await logger.error(`未対応の systemType: ${adapterName ?? "null"}`);
    await updateJobStatus(db, scraper_jobs.id, "failed", {
      errorMessage: `未対応の systemType: ${adapterName ?? "null"}`,
    });
    return;
  }

  await logger.info(
    `${adapterName}: ${municipalities.name} の議事録一覧をキューに投入します`
  );
  await queue.send({
    type: "scraper:list",
    systemType: adapterName,
    jobId: scraper_jobs.id,
    municipalityId: municipalities.id,
    municipalityName: municipalities.name,
    prefecture: municipalities.prefecture,
    baseUrl: municipalities.baseUrl,
    year: scraper_jobs.year,
  });
}
