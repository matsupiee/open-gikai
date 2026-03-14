import type { Db } from "@open-gikai/db";
import { meetings, municipalities } from "@open-gikai/db";
import { and, asc, count, eq, gt, ilike, or } from "drizzle-orm";
import { z } from "zod";

import type { municipalitiesListSchema } from "./_schemas";

export interface MunicipalityListItem {
  id: string;
  code: string;
  name: string;
  prefecture: string;
  baseUrl: string | null;
  meetingCount: number;
}

export interface MunicipalitiesListResponse {
  municipalities: MunicipalityListItem[];
  nextCursor: string | null;
}

export async function listMunicipalities(
  db: Db,
  input: z.infer<typeof municipalitiesListSchema>
): Promise<MunicipalitiesListResponse> {
  const limit = input.limit ?? 50;
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
  if (input.cursor) conditions.push(gt(municipalities.code, input.cursor));

  const results = await db
    .select({
      id: municipalities.id,
      code: municipalities.code,
      name: municipalities.name,
      prefecture: municipalities.prefecture,
      baseUrl: municipalities.baseUrl,
      meetingCount: count(meetings.id),
    })
    .from(municipalities)
    .leftJoin(meetings, eq(meetings.municipalityId, municipalities.id))
    .where(and(...conditions))
    .groupBy(municipalities.id, municipalities.code, municipalities.name, municipalities.prefecture, municipalities.baseUrl)
    .orderBy(asc(municipalities.prefecture), asc(municipalities.code))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const list = hasMore ? results.slice(0, limit) : results;

  return {
    municipalities: list as MunicipalityListItem[],
    nextCursor: hasMore ? list[list.length - 1]!.code : null,
  };
}
