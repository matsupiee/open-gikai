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

  // DiscussNet SSP は4フェーズの特殊ケースなので個別処理を維持
  if (systemType?.name === "discussnet_ssp") {
    await dispatchDiscussnetSsp(db, queue, scraper_jobs, municipalities, logger);
    return;
  }

  // それ以外は adapter registry を使って汎用メッセージを投入
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

/**
 * DiscussNet SSP 用の dispatch 処理。
 * 4フェーズ (schedule → minute) の特殊構造のため個別に実装を維持する。
 */
async function dispatchDiscussnetSsp(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  job: typeof scraper_jobs.$inferSelect,
  municipality: typeof municipalities.$inferSelect,
  logger: ReturnType<typeof createJobLogger>
): Promise<void> {
  // baseUrl: https://ssp.kaigiroku.net/tenant/{slug}/MinuteSearch.html
  //          http://giji.city.yokohama.lg.jp/tenant/yokohama/MinuteSearch.html (自ホスト版)
  const slugMatch = municipality.baseUrl!.match(/\/tenant\/([^/]+)\//);
  if (!slugMatch?.[1]) {
    await logger.error(
      `DiscussNet SSP: ${municipality.name} の baseUrl からテナントスラッグを抽出できません: ${municipality.baseUrl}`
    );
    await updateJobStatus(db, job.id, "failed", {
      errorMessage: `テナントスラッグ抽出失敗: ${municipality.baseUrl}`,
    });
    return;
  }
  const tenantSlug = slugMatch[1];

  // 自ホスト版の場合はホストを baseUrl から抽出する
  // smart.discussvision.net は API が ssp.kaigiroku.net と共通のため自ホスト扱いしない
  const isDiscussvision = municipality.baseUrl!.includes("discussvision.net");
  const isSelfHosted =
    !municipality.baseUrl!.includes("ssp.kaigiroku.net") && !isDiscussvision;
  const host = isSelfHosted ? extractHost(municipality.baseUrl!) : undefined;
  const apiBase = isSelfHosted ? buildApiBase(municipality.baseUrl!) : undefined;

  // smart.discussvision.net の自治体は tenant_id の取得に注意が必要:
  // - 一部は ssp.kaigiroku.net にも存在し、そちらの tenant_id が API で有効
  // - 一部は ssp.kaigiroku.net に存在せず、smart.discussvision.net の tenant_id が必要
  let tenantId: number | null;
  if (isDiscussvision) {
    tenantId = await fetchTenantId(tenantSlug);
    if (!tenantId) {
      const tenantJsUrl = municipality.baseUrl!.replace(/\/rd\/[^/]+$/, "/js/tenant.js");
      tenantId = await fetchTenantId(tenantSlug, undefined, tenantJsUrl);
    }
  } else {
    tenantId = await fetchTenantId(tenantSlug, host);
  }
  if (!tenantId) {
    await logger.error(
      `DiscussNet SSP: ${municipality.name} の tenantId を取得できません (slug=${tenantSlug})`
    );
    await updateJobStatus(db, job.id, "failed", {
      errorMessage: `tenantId 取得失敗: slug=${tenantSlug}`,
    });
    return;
  }

  const councils = await fetchCouncils(tenantId, job.year, apiBase);

  if (councils.length === 0) {
    await logger.warn(
      `DiscussNet SSP: ${municipality.name} に対象 council が見つかりません (tenantId=${tenantId} year=${job.year})`
    );
    await updateJobStatus(db, job.id, "completed");
    return;
  }

  await logger.info(
    `DiscussNet SSP: ${municipality.name} の ${councils.length} 件の council をキューに投入します`
  );

  for (const council of councils) {
    await queue.send({
      type: "discussnet-ssp:schedule",
      jobId: job.id,
      municipalityId: municipality.id,
      municipalityName: municipality.name,
      prefecture: municipality.prefecture,
      tenantSlug,
      tenantId,
      councilId: council.councilId,
      councilName: council.name,
      host,
    });
  }
}
