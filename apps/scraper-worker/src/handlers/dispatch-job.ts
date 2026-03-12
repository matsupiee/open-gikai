import { municipalities, scraper_jobs } from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import { createJobLogger, updateJobStatus } from "../db/job-logger";
import type { ScraperQueueMessage } from "../utils/types";

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
  }
): Promise<void> {
  const { scraper_jobs, municipalities } = job;
  const logger = createJobLogger(db, scraper_jobs.id);

  await updateJobStatus(db, scraper_jobs.id, "running");
  await logger(
    "info",
    `ジョブ開始: municipality=${municipalities.name} systemType=${municipalities.systemType}`
  );

  switch (municipalities.systemType) {
    case "discussnet": {
      if (!municipalities.baseUrl) {
        await logger(
          "error",
          `DiscussNet: ${municipalities.name} の baseUrl が未設定です`
        );
        await updateJobStatus(db, scraper_jobs.id, "failed", {
          errorMessage: `baseUrl が未設定: municipalityId=${scraper_jobs.municipalityId}`,
        });
        return;
      }

      await logger(
        "info",
        `DiscussNet: ${municipalities.name} の議事録一覧をキューに投入します`
      );
      await queue.send({
        type: "discussnet-list",
        jobId: scraper_jobs.id,
        municipalityId: municipalities.id,
        municipalityName: municipalities.name,
        prefecture: municipalities.prefecture,
        baseUrl: municipalities.baseUrl,
        year: scraper_jobs.year,
        page: 1,
      });
      break;
    }

    default: {
      await logger(
        "error",
        `未対応の systemType: ${municipalities.systemType}`
      );
      await updateJobStatus(db, scraper_jobs.id, "failed", {
        errorMessage: `未対応の systemType: ${municipalities.systemType}`,
      });
    }
  }
}
