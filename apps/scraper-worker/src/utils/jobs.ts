import { eq } from "drizzle-orm";
import {
  municipalities,
  scraper_jobs,
  system_types,
} from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";

/**
 * status="pending" のジョブを取得する共通クエリ。
 * index.ts (scheduled) と local-runner.ts の両方から使用される。
 */
export async function fetchPendingJobs(db: Db) {
  return db
    .select()
    .from(scraper_jobs)
    .innerJoin(
      municipalities,
      eq(scraper_jobs.municipalityId, municipalities.id)
    )
    .leftJoin(system_types, eq(municipalities.systemTypeId, system_types.id))
    .where(eq(scraper_jobs.status, "pending"))
    .limit(10);
}
