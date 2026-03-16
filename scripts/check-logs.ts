import { createDb } from "@open-gikai/db";
import {
  scraper_job_logs,
  scraper_jobs,
} from "@open-gikai/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";
import { appendFile, writeFile } from "node:fs/promises";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

// Query error/warn logs from the past hour
const recentLogs = await db
  .select({
    id: scraper_job_logs.id,
    jobId: scraper_job_logs.jobId,
    level: scraper_job_logs.level,
    message: scraper_job_logs.message,
    createdAt: scraper_job_logs.createdAt,
  })
  .from(scraper_job_logs)
  .where(
    and(
      inArray(scraper_job_logs.level, ["error", "warn"]),
      gte(scraper_job_logs.createdAt, oneHourAgo),
    ),
  )
  .orderBy(scraper_job_logs.createdAt);

// Query failed jobs from the past hour
const failedJobs = await db
  .select({
    id: scraper_jobs.id,
    municipalityId: scraper_jobs.municipalityId,
    status: scraper_jobs.status,
    year: scraper_jobs.year,
    errorMessage: scraper_jobs.errorMessage,
    processedItems: scraper_jobs.processedItems,
    totalItems: scraper_jobs.totalItems,
    totalInserted: scraper_jobs.totalInserted,
    totalSkipped: scraper_jobs.totalSkipped,
    createdAt: scraper_jobs.createdAt,
    completedAt: scraper_jobs.completedAt,
  })
  .from(scraper_jobs)
  .where(
    and(
      eq(scraper_jobs.status, "failed"),
      gte(scraper_jobs.createdAt, oneHourAgo),
    ),
  )
  .orderBy(scraper_jobs.createdAt);

const errorLogs = recentLogs.filter((l) => l.level === "error");
const warnLogs = recentLogs.filter((l) => l.level === "warn");

const hasErrors = errorLogs.length > 0 || failedJobs.length > 0;

const summary = {
  checkedAt: new Date().toISOString(),
  window: "1 hour",
  hasErrors,
  counts: {
    errorLogs: errorLogs.length,
    warnLogs: warnLogs.length,
    failedJobs: failedJobs.length,
  },
  errorLogs,
  warnLogs,
  failedJobs,
};

// Output JSON summary to stdout
console.log(JSON.stringify(summary, null, 2));

// Write detailed error info to /tmp/error-logs.json
await writeFile("/tmp/error-logs.json", JSON.stringify(summary, null, 2));

// Set GitHub Actions output
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  await appendFile(githubOutput, `has_errors=${hasErrors}\n`);
}

// Exit cleanly
process.exit(0);
