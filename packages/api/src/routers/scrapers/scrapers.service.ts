import type { Db } from "@open-gikai/db";
import { scraper_jobs, scraper_job_logs } from "@open-gikai/db";
import { ORPCError } from "@orpc/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type {
  scrapersListJobsSchema,
  scrapersCreateJobSchema,
  scrapersGetJobSchema,
  scrapersCancelJobSchema,
  scrapersGetJobLogsSchema,
} from "./_schemas";
export interface ScraperJob {
  id: string;
  municipalityId: string;
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

function rowToJob(row: typeof scraper_jobs.$inferSelect): ScraperJob {
  return {
    id: row.id,
    municipalityId: row.municipalityId,
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
  const rows = await db
    .select()
    .from(scraper_jobs)
    .orderBy(desc(scraper_jobs.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  const countResult = await db.$count(scraper_jobs);

  return {
    jobs: rows.map(rowToJob),
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

export async function getJob(
  db: Db,
  input: z.infer<typeof scrapersGetJobSchema>
): Promise<ScraperJob> {
  const [row] = await db
    .select()
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, input.jobId));

  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: `ジョブ ${input.jobId} が見つかりません`,
    });
  }

  return rowToJob(row);
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
