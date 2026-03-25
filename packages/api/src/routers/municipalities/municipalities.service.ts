import type { ShardedMinutesDb } from "@open-gikai/db-minutes";
import { municipalities } from "@open-gikai/db-minutes";
import { and, asc, count, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { municipalitiesListSchema } from "./_schemas";

export interface MunicipalityListItem {
  id: string;
  code: string;
  name: string;
  prefecture: string;
  baseUrl: string | null;
  population: number | null;
  meetingCount: number;
  systemTypeDescription: string | null;
}

export interface MunicipalitiesListResponse {
  municipalities: MunicipalityListItem[];
  total: number;
}

export async function listMunicipalities(
  shardedDb: ShardedMinutesDb,
  input: z.infer<typeof municipalitiesListSchema>,
  isAdmin: boolean
): Promise<MunicipalitiesListResponse> {
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  // index.sqlite には自治体マスタのみがある（meetings は含まれない）ため、
  // 全シャードから meetingCount を集計する必要がある。
  // ただし meetingCount は概算で良いため、index.sqlite で自治体一覧を取得し、
  // meetingCount は 0 で返す（将来的にはキャッシュで対応）。
  const db = shardedDb.getIndexDb();

  const conditions = [eq(municipalities.enabled, true)];

  if (input.query) {
    const tokens = input.query.trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      conditions.push(
        or(
          like(municipalities.name, `%${token}%`),
          like(municipalities.prefecture, `%${token}%`),
          like(municipalities.baseUrl, `%${token}%`)
        )!
      );
    }
  }

  const where = and(...conditions);

  const orderBy =
    input.sortBy === "population"
      ? [sql`${municipalities.population} DESC NULLS LAST`, asc(municipalities.code)]
      : [asc(municipalities.prefecture), asc(municipalities.code)];

  const [results, [countRow]] = await Promise.all([
    db
      .select({
        id: municipalities.code,
        code: municipalities.code,
        name: municipalities.name,
        prefecture: municipalities.prefecture,
        baseUrl: municipalities.baseUrl,
        population: municipalities.population,
        meetingCount: sql<number>`0`,
        systemTypeDescription: sql<string | null>`null`,
      })
      .from(municipalities)
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(municipalities)
      .where(where),
  ]);

  return {
    municipalities: results.map((r) => ({
      ...r,
      baseUrl: isAdmin ? r.baseUrl : null,
    })) as MunicipalityListItem[],
    total: countRow?.total ?? 0,
  };
}
