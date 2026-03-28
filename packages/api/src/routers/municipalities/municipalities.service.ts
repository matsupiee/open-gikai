import type { Db } from "@open-gikai/db";
import { municipalities } from "@open-gikai/db/schema";
import { asc, count, like, or, sql, and, inArray } from "drizzle-orm";
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
  db: Db,
  input: z.input<typeof municipalitiesListSchema>,
  isAdmin: boolean
): Promise<MunicipalitiesListResponse> {
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const conditions = [];

  if (input.codes && input.codes.length > 0) {
    conditions.push(inArray(municipalities.code, input.codes));
  }

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

  const where = conditions.length > 0 ? and(...conditions) : undefined;

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
