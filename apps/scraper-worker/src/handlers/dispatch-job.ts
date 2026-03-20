import {
  municipalities,
  scraper_jobs,
  system_types,
} from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import { createJobLogger, updateJobStatus } from "../utils/job-logger";
import {
  fetchTenantId,
  fetchCouncils,
} from "@open-gikai/scrapers/discussnet-ssp";
import { buildApiBase, extractHost } from "@open-gikai/scrapers/discussnet-ssp";
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

  switch (systemType?.name) {
    case "discussnet_ssp": {
      // baseUrl: https://ssp.kaigiroku.net/tenant/{slug}/MinuteSearch.html
      //          http://giji.city.yokohama.lg.jp/tenant/yokohama/MinuteSearch.html (自ホスト版)
      const slugMatch = municipalities.baseUrl.match(/\/tenant\/([^/]+)\//);
      if (!slugMatch?.[1]) {
        await logger.error(
          `DiscussNet SSP: ${municipalities.name} の baseUrl からテナントスラッグを抽出できません: ${municipalities.baseUrl}`
        );
        await updateJobStatus(db, scraper_jobs.id, "failed", {
          errorMessage: `テナントスラッグ抽出失敗: ${municipalities.baseUrl}`,
        });
        return;
      }
      const tenantSlug = slugMatch[1];

      // 自ホスト版の場合はホストを baseUrl から抽出する
      const isSelfHosted = !municipalities.baseUrl.includes("ssp.kaigiroku.net");
      const host = isSelfHosted ? extractHost(municipalities.baseUrl) : undefined;
      const apiBase = isSelfHosted ? buildApiBase(municipalities.baseUrl) : undefined;

      const tenantId = await fetchTenantId(tenantSlug, host);
      if (!tenantId) {
        await logger.error(
          `DiscussNet SSP: ${municipalities.name} の tenantId を取得できません (slug=${tenantSlug})`
        );
        await updateJobStatus(db, scraper_jobs.id, "failed", {
          errorMessage: `tenantId 取得失敗: slug=${tenantSlug}`,
        });
        return;
      }

      const councils = await fetchCouncils(tenantId, scraper_jobs.year, apiBase);

      if (councils.length === 0) {
        await logger.warn(
          `DiscussNet SSP: ${municipalities.name} に対象 council が見つかりません (tenantId=${tenantId} year=${scraper_jobs.year})`
        );
        await updateJobStatus(db, scraper_jobs.id, "completed");
        return;
      }

      await logger.info(
        `DiscussNet SSP: ${municipalities.name} の ${councils.length} 件の council をキューに投入します`
      );

      for (const council of councils) {
        await queue.send({
          type: "discussnet-ssp:schedule",
          jobId: scraper_jobs.id,
          municipalityId: municipalities.id,
          municipalityName: municipalities.name,
          prefecture: municipalities.prefecture,
          tenantSlug,
          tenantId,
          councilId: council.councilId,
          councilName: council.name,
          host,
        });
      }
      break;
    }

    case "dbsearch": {
      await logger.info(
        `dbsr.jp: ${municipalities.name} の議事録一覧をキューに投入します`
      );
      await queue.send({
        type: "dbsearch:list",
        jobId: scraper_jobs.id,
        municipalityId: municipalities.id,
        municipalityName: municipalities.name,
        prefecture: municipalities.prefecture,
        baseUrl: municipalities.baseUrl,
        year: scraper_jobs.year,
      });
      break;
    }

    case "kensakusystem": {
      await logger.info(
        `kensakusystem: ${municipalities.name} の議事録一覧をキューに投入します`
      );
      await queue.send({
        type: "kensakusystem:list",
        jobId: scraper_jobs.id,
        municipalityId: municipalities.id,
        municipalityName: municipalities.name,
        baseUrl: municipalities.baseUrl,
        year: scraper_jobs.year,
      });
      break;
    }

    case "gijiroku_com": {
      await logger.info(
        `gijiroku.com: ${municipalities.name} の会議一覧をキューに投入します`
      );
      await queue.send({
        type: "gijiroku-com:list",
        jobId: scraper_jobs.id,
        municipalityId: municipalities.id,
        municipalityName: municipalities.name,
        prefecture: municipalities.prefecture,
        baseUrl: municipalities.baseUrl,
        year: scraper_jobs.year,
      });
      break;
    }

    default: {
      await logger.error(`未対応の systemType: ${systemType?.name ?? "null"}`);
      await updateJobStatus(db, scraper_jobs.id, "failed", {
        errorMessage: `未対応の systemType: ${systemType?.name ?? "null"}`,
      });
    }
  }
}
