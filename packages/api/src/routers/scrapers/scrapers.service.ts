import type { Db } from "@open-gikai/db";
import { scraper_jobs, scraper_job_logs, municipalities, system_types } from "@open-gikai/db";
import { meetings, statements } from "@open-gikai/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, countDistinct, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type {
  scrapersListJobsSchema,
  scrapersCreateJobSchema,
  scrapersCreateBulkJobsSchema,
  scrapersGetJobSchema,
  scrapersCancelJobSchema,
  scrapersGetJobLogsSchema,
  scrapersListMunicipalitiesSchema,
  scrapersReprocessStatementsSchema,
  scrapersProgressByPrefectureSchema,
  scrapersProgressByMunicipalitySchema,
  scrapersProgressByYearSchema,
} from "./_schemas";
export interface ScraperJob {
  id: string;
  municipalityId: string;
  municipalityName: string;
  prefecture: string;
  systemTypeDescription: string | null;
  status: string;
  year: number;
  processedItems: number;
  totalItems: number | null;
  totalInserted: number;
  totalSkipped: number;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface ScraperJobLog {
  id: string;
  jobId: string;
  level: string;
  message: string;
  createdAt: Date;
}

export interface ListJobsResponse {
  jobs: ScraperJob[];
  total: number;
}

export interface GetJobLogsResponse {
  logs: ScraperJobLog[];
}

export interface Municipality {
  id: string;
  code: string;
  name: string;
  prefecture: string;
  systemTypeDescription: string | null;
}

function rowToJob(
  row: typeof scraper_jobs.$inferSelect,
  municipalityName = "",
  prefecture = "",
  systemTypeDescription: string | null = null
): ScraperJob {
  return {
    id: row.id,
    municipalityId: row.municipalityId,
    municipalityName,
    prefecture,
    systemTypeDescription,
    status: row.status,
    year: row.year,
    processedItems: row.processedItems,
    totalItems: row.totalItems ?? null,
    totalInserted: row.totalInserted,
    totalSkipped: row.totalSkipped,
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
  };
}

export async function listJobs(
  db: Db,
  input: z.infer<typeof scrapersListJobsSchema>
): Promise<ListJobsResponse> {
  const [rows, countResult] = await Promise.all([
    db
      .select({
        job: scraper_jobs,
        municipalityName: municipalities.name,
        prefecture: municipalities.prefecture,
        systemTypeDescription: system_types.description,
      })
      .from(scraper_jobs)
      .leftJoin(municipalities, eq(scraper_jobs.municipalityId, municipalities.id))
      .leftJoin(system_types, eq(municipalities.systemTypeId, system_types.id))
      .orderBy(desc(scraper_jobs.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    db.$count(scraper_jobs),
  ]);

  return {
    jobs: rows.map((r) =>
      rowToJob(r.job, r.municipalityName ?? "", r.prefecture ?? "", r.systemTypeDescription ?? null)
    ),
    total: countResult,
  };
}

export async function createJob(
  db: Db,
  input: z.infer<typeof scrapersCreateJobSchema>
): Promise<ScraperJob> {
  const [row] = await db
    .insert(scraper_jobs)
    .values({
      municipalityId: input.municipalityId,
      status: "pending",
      year: input.year,
    })
    .returning();

  if (!row) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "ジョブの作成に失敗しました",
    });
  }

  return rowToJob(row);
}

export interface CreateBulkJobsResponse {
  createdCount: number;
  skippedCount: number;
}

export async function createBulkJobs(
  db: Db,
  input: z.infer<typeof scrapersCreateBulkJobsSchema>
): Promise<CreateBulkJobsResponse> {
  // 1. enabled かつ baseUrl がある自治体を取得
  const enabledMunicipalities = await db
    .select({ id: municipalities.id })
    .from(municipalities)
    .where(
      and(
        eq(municipalities.enabled, true),
        isNotNull(municipalities.baseUrl),
        ne(municipalities.baseUrl, "")
      )
    );

  if (enabledMunicipalities.length === 0) {
    return { createdCount: 0, skippedCount: 0 };
  }

  // 2. 該当年度で pending/queued/running のジョブがある自治体を取得
  const activeJobs = await db
    .select({ municipalityId: scraper_jobs.municipalityId })
    .from(scraper_jobs)
    .where(
      and(
        eq(scraper_jobs.year, input.year),
        inArray(scraper_jobs.status, ["pending", "queued", "running"])
      )
    );

  const activeMunicipalityIds = new Set(activeJobs.map((j) => j.municipalityId));

  // 3. アクティブジョブがない自治体のみ対象
  const targetMunicipalities = enabledMunicipalities.filter(
    (m) => !activeMunicipalityIds.has(m.id)
  );

  const skippedCount = enabledMunicipalities.length - targetMunicipalities.length;

  if (targetMunicipalities.length === 0) {
    return { createdCount: 0, skippedCount };
  }

  // 4. 一括 insert
  await db.insert(scraper_jobs).values(
    targetMunicipalities.map((m) => ({
      municipalityId: m.id,
      status: "pending" as const,
      year: input.year,
    }))
  );

  return { createdCount: targetMunicipalities.length, skippedCount };
}

export async function getJob(
  db: Db,
  input: z.infer<typeof scrapersGetJobSchema>
): Promise<ScraperJob> {
  const [row] = await db
    .select({
      job: scraper_jobs,
      municipalityName: municipalities.name,
      prefecture: municipalities.prefecture,
      systemTypeDescription: system_types.description,
    })
    .from(scraper_jobs)
    .leftJoin(municipalities, eq(scraper_jobs.municipalityId, municipalities.id))
    .leftJoin(system_types, eq(municipalities.systemTypeId, system_types.id))
    .where(eq(scraper_jobs.id, input.jobId));

  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: `ジョブ ${input.jobId} が見つかりません`,
    });
  }

  return rowToJob(row.job, row.municipalityName ?? "", row.prefecture ?? "", row.systemTypeDescription ?? null);
}

export async function cancelJob(
  db: Db,
  input: z.infer<typeof scrapersCancelJobSchema>
): Promise<ScraperJob> {
  const [existing] = await db
    .select({ status: scraper_jobs.status })
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, input.jobId));

  if (!existing) {
    throw new ORPCError("NOT_FOUND", {
      message: `ジョブ ${input.jobId} が見つかりません`,
    });
  }

  if (
    existing.status === "completed" ||
    existing.status === "failed" ||
    existing.status === "cancelled"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message: `ステータスが ${existing.status} のジョブはキャンセルできません`,
    });
  }

  const [row] = await db
    .update(scraper_jobs)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(scraper_jobs.id, input.jobId))
    .returning();

  if (!row) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "キャンセルに失敗しました",
    });
  }

  return rowToJob(row);
}

export async function listMunicipalities(
  db: Db,
  _input: z.infer<typeof scrapersListMunicipalitiesSchema>
): Promise<Municipality[]> {
  const rows = await db
    .select({
      id: municipalities.id,
      code: municipalities.code,
      name: municipalities.name,
      prefecture: municipalities.prefecture,
      systemTypeDescription: system_types.description,
    })
    .from(municipalities)
    .leftJoin(system_types, eq(municipalities.systemTypeId, system_types.id))
    .where(eq(municipalities.enabled, true))
    .orderBy(asc(municipalities.code));

  return rows;
}

export interface ReprocessStatementsResponse {
  reprocessedCount: number;
}

export async function reprocessStatements(
  db: Db,
  input: z.infer<typeof scrapersReprocessStatementsSchema>
): Promise<ReprocessStatementsResponse> {
  const targetMeetings = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(eq(meetings.municipalityId, input.municipalityId));

  if (targetMeetings.length === 0) {
    return { reprocessedCount: 0 };
  }

  const meetingIds = targetMeetings.map((m) => m.id);

  await db.transaction(async (tx) => {
    await tx.delete(statements).where(inArray(statements.meetingId, meetingIds));
    await tx
      .update(meetings)
      .set({ status: "pending" })
      .where(eq(meetings.municipalityId, input.municipalityId));
  });

  return { reprocessedCount: targetMeetings.length };
}

export async function getJobLogs(
  db: Db,
  input: z.infer<typeof scrapersGetJobLogsSchema>
): Promise<GetJobLogsResponse> {
  const rows = await db
    .select()
    .from(scraper_job_logs)
    .where(eq(scraper_job_logs.jobId, input.jobId))
    .orderBy(asc(scraper_job_logs.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return {
    logs: rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      level: row.level,
      message: row.message,
      createdAt: row.createdAt,
    })),
  };
}

// ── Progress queries ──────────────────────────────────────────

export interface PrefectureProgress {
  prefecture: string;
  totalMunicipalities: number;
  scrapedMunicipalities: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  totalMeetings: number;
}

export async function progressByPrefecture(
  db: Db,
  _input: z.infer<typeof scrapersProgressByPrefectureSchema>
): Promise<PrefectureProgress[]> {
  // Query 1: job-level stats grouped by prefecture
  const jobStats = await db
    .select({
      prefecture: municipalities.prefecture,
      totalMunicipalities: count(municipalities.id),
      scrapedMunicipalities: sql<number>`count(distinct case when ${scraper_jobs.status} = 'completed' then ${municipalities.id} end)`.as("scraped_municipalities"),
      totalJobs: sql<number>`count(${scraper_jobs.id})`.as("total_jobs"),
      completedJobs: sql<number>`count(case when ${scraper_jobs.status} = 'completed' then 1 end)`.as("completed_jobs"),
      failedJobs: sql<number>`count(case when ${scraper_jobs.status} = 'failed' then 1 end)`.as("failed_jobs"),
      activeJobs: sql<number>`count(case when ${scraper_jobs.status} in ('pending', 'queued', 'running') then 1 end)`.as("active_jobs"),
    })
    .from(municipalities)
    .leftJoin(scraper_jobs, eq(municipalities.id, scraper_jobs.municipalityId))
    .groupBy(municipalities.prefecture)
    .orderBy(asc(municipalities.prefecture));

  // Query 2: meeting counts grouped by prefecture
  const meetingStats = await db
    .select({
      prefecture: municipalities.prefecture,
      totalMeetings: count(meetings.id),
    })
    .from(meetings)
    .innerJoin(municipalities, eq(meetings.municipalityId, municipalities.id))
    .groupBy(municipalities.prefecture);

  const meetingMap = new Map(
    meetingStats.map((r) => [r.prefecture, Number(r.totalMeetings)])
  );

  return jobStats.map((r) => ({
    prefecture: r.prefecture,
    totalMunicipalities: Number(r.totalMunicipalities),
    scrapedMunicipalities: Number(r.scrapedMunicipalities),
    totalJobs: Number(r.totalJobs),
    completedJobs: Number(r.completedJobs),
    failedJobs: Number(r.failedJobs),
    activeJobs: Number(r.activeJobs),
    totalMeetings: meetingMap.get(r.prefecture) ?? 0,
  }));
}

export interface MunicipalityProgress {
  municipalityId: string;
  name: string;
  prefecture: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  totalMeetings: number;
  totalInserted: number;
}

export interface MunicipalityProgressResponse {
  items: MunicipalityProgress[];
  total: number;
}

export async function progressByMunicipality(
  db: Db,
  input: z.infer<typeof scrapersProgressByMunicipalitySchema>
): Promise<MunicipalityProgressResponse> {
  const whereClause = input.prefecture
    ? eq(municipalities.prefecture, input.prefecture)
    : undefined;

  // Main query with pagination
  const rows = await db
    .select({
      municipalityId: municipalities.id,
      name: municipalities.name,
      prefecture: municipalities.prefecture,
      totalJobs: sql<number>`count(${scraper_jobs.id})`.as("total_jobs"),
      completedJobs: sql<number>`count(case when ${scraper_jobs.status} = 'completed' then 1 end)`.as("completed_jobs"),
      failedJobs: sql<number>`count(case when ${scraper_jobs.status} = 'failed' then 1 end)`.as("failed_jobs"),
      activeJobs: sql<number>`count(case when ${scraper_jobs.status} in ('pending', 'queued', 'running') then 1 end)`.as("active_jobs"),
      totalInserted: sql<number>`coalesce(sum(${scraper_jobs.totalInserted}), 0)`.as("total_inserted"),
    })
    .from(municipalities)
    .leftJoin(scraper_jobs, eq(municipalities.id, scraper_jobs.municipalityId))
    .where(whereClause)
    .groupBy(municipalities.id, municipalities.name, municipalities.prefecture)
    .orderBy(asc(municipalities.prefecture), asc(municipalities.name))
    .limit(input.limit)
    .offset(input.offset);

  // Count total
  const totalResult = whereClause
    ? await db.$count(municipalities, whereClause)
    : await db.$count(municipalities);

  // Meeting counts for the municipalities in the current page
  const municipalityIds = rows.map((r) => r.municipalityId);
  let meetingMap = new Map<string, number>();
  if (municipalityIds.length > 0) {
    const meetingStats = await db
      .select({
        municipalityId: meetings.municipalityId,
        totalMeetings: count(meetings.id),
      })
      .from(meetings)
      .where(inArray(meetings.municipalityId, municipalityIds))
      .groupBy(meetings.municipalityId);

    meetingMap = new Map(
      meetingStats.map((r) => [r.municipalityId, Number(r.totalMeetings)])
    );
  }

  return {
    items: rows.map((r) => ({
      municipalityId: r.municipalityId,
      name: r.name,
      prefecture: r.prefecture,
      totalJobs: Number(r.totalJobs),
      completedJobs: Number(r.completedJobs),
      failedJobs: Number(r.failedJobs),
      activeJobs: Number(r.activeJobs),
      totalMeetings: meetingMap.get(r.municipalityId) ?? 0,
      totalInserted: Number(r.totalInserted),
    })),
    total: totalResult,
  };
}

export interface YearProgress {
  year: number;
  totalMunicipalities: number;
  completedMunicipalities: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  totalInserted: number;
  totalSkipped: number;
}

export async function progressByYear(
  db: Db,
  _input: z.infer<typeof scrapersProgressByYearSchema>
): Promise<YearProgress[]> {
  const rows = await db
    .select({
      year: scraper_jobs.year,
      totalMunicipalities: countDistinct(scraper_jobs.municipalityId),
      completedMunicipalities: sql<number>`count(distinct case when ${scraper_jobs.status} = 'completed' then ${scraper_jobs.municipalityId} end)`.as("completed_municipalities"),
      totalJobs: count(scraper_jobs.id),
      completedJobs: sql<number>`count(case when ${scraper_jobs.status} = 'completed' then 1 end)`.as("completed_jobs"),
      failedJobs: sql<number>`count(case when ${scraper_jobs.status} = 'failed' then 1 end)`.as("failed_jobs"),
      activeJobs: sql<number>`count(case when ${scraper_jobs.status} in ('pending', 'queued', 'running') then 1 end)`.as("active_jobs"),
      totalInserted: sql<number>`coalesce(sum(${scraper_jobs.totalInserted}), 0)`.as("total_inserted"),
      totalSkipped: sql<number>`coalesce(sum(${scraper_jobs.totalSkipped}), 0)`.as("total_skipped"),
    })
    .from(scraper_jobs)
    .groupBy(scraper_jobs.year)
    .orderBy(desc(scraper_jobs.year));

  return rows.map((r) => ({
    year: r.year,
    totalMunicipalities: Number(r.totalMunicipalities),
    completedMunicipalities: Number(r.completedMunicipalities),
    totalJobs: Number(r.totalJobs),
    completedJobs: Number(r.completedJobs),
    failedJobs: Number(r.failedJobs),
    activeJobs: Number(r.activeJobs),
    totalInserted: Number(r.totalInserted),
    totalSkipped: Number(r.totalSkipped),
  }));
}
