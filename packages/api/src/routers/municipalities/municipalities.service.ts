import type { Db } from "@open-gikai/db";
import { meetings, municipalities, system_types } from "@open-gikai/db";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
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
  input: z.infer<typeof municipalitiesListSchema>,
  isAdmin: boolean
): Promise<MunicipalitiesListResponse> {
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  const conditions = [eq(municipalities.enabled, true)];

  if (input.query) {
    const tokens = input.query.trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      conditions.push(
        or(
          ilike(municipalities.name, `%${token}%`),
          ilike(municipalities.prefecture, `%${token}%`),
          ilike(municipalities.baseUrl, `%${token}%`)
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
        id: municipalities.id,
        code: municipalities.code,
        name: municipalities.name,
        prefecture: municipalities.prefecture,
        baseUrl: municipalities.baseUrl,
        population: municipalities.population,
        meetingCount: count(meetings.id),
        systemTypeDescription: system_types.description,
      })
      .from(municipalities)
      .leftJoin(meetings, eq(meetings.municipalityId, municipalities.id))
      .leftJoin(system_types, eq(system_types.id, municipalities.systemTypeId))
      .where(where)
      .groupBy(
        municipalities.id,
        municipalities.code,
        municipalities.name,
        municipalities.prefecture,
        municipalities.baseUrl,
        municipalities.population,
        system_types.description
      )
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
