import type { Db, ShardedMinutesDb } from "@open-gikai/db-minutes";
import { meetings, municipalities, statements } from "@open-gikai/db-minutes";
import { and, asc, desc, eq, gte, like, lte, lt } from "drizzle-orm";
import { z } from "zod";

import type { meetingsListSchema, meetingStatementsSchema } from "./_schemas";

export interface MeetingListItem {
  id: string;
  title: string;
  meetingType: string;
  heldOn: string;
  prefecture: string;
  municipality: string;
  sourceUrl: string | null;
  status: string;
}

export interface MeetingsListResponse {
  meetings: MeetingListItem[];
  nextCursor: string | null;
}

export interface MeetingStatement {
  id: string;
  kind: string;
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
}

export interface MeetingDetail extends MeetingListItem {
  statements: MeetingStatement[];
}

function queryMeetingsFromShard(
  db: Db,
  input: z.infer<typeof meetingsListSchema>,
  limit: number,
) {
  const conditions = [];

  if (input.heldOnFrom) conditions.push(gte(meetings.heldOn, input.heldOnFrom));
  if (input.heldOnTo) conditions.push(lte(meetings.heldOn, input.heldOnTo));
  if (input.prefecture) conditions.push(eq(municipalities.prefecture, input.prefecture));
  if (input.municipality) {
    const tokens = input.municipality.trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      conditions.push(like(municipalities.name, `%${token}%`));
    }
  }
  if (input.meetingType) conditions.push(eq(meetings.meetingType, input.meetingType));
  if (input.cursor) conditions.push(lt(meetings.id, input.cursor));

  const query = db
    .select({
      id: meetings.id,
      title: meetings.title,
      meetingType: meetings.meetingType,
      heldOn: meetings.heldOn,
      prefecture: municipalities.prefecture,
      municipality: municipalities.name,
      sourceUrl: meetings.sourceUrl,
      status: meetings.status,
    })
    .from(meetings)
    .innerJoin(municipalities, eq(meetings.municipalityCode, municipalities.code));

  const finalQuery = conditions.length > 0 ? query.where(and(...conditions)) : query;

  return finalQuery
    .orderBy(desc(meetings.heldOn), desc(meetings.id))
    .limit(limit);
}

export async function listMeetings(
  shardedDb: ShardedMinutesDb,
  input: z.infer<typeof meetingsListSchema>,
): Promise<MeetingsListResponse> {
  const limit = input.limit ?? 20;
  const dbs = shardedDb.getRelevantDbs({
    heldOnFrom: input.heldOnFrom,
    heldOnTo: input.heldOnTo,
    prefecture: input.prefecture,
  });

  const allResults: MeetingListItem[] = [];
  for (const db of dbs) {
    const results = await queryMeetingsFromShard(db, input, limit + 1);
    allResults.push(...(results as MeetingListItem[]));
  }

  allResults.sort((a, b) => {
    const cmp = b.heldOn.localeCompare(a.heldOn);
    if (cmp !== 0) return cmp;
    return b.id.localeCompare(a.id);
  });

  const hasMore = allResults.length > limit;
  const meetingsList = hasMore ? allResults.slice(0, limit) : allResults;

  return {
    meetings: meetingsList,
    nextCursor: hasMore ? meetingsList[meetingsList.length - 1]!.id : null,
  };
}

export async function getMeetingStatements(
  shardedDb: ShardedMinutesDb,
  input: z.infer<typeof meetingStatementsSchema>,
): Promise<MeetingDetail> {
  const dbs = shardedDb.getAllDbs();

  for (const db of dbs) {
    const [meeting] = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        meetingType: meetings.meetingType,
        heldOn: meetings.heldOn,
        prefecture: municipalities.prefecture,
        municipality: municipalities.name,
        sourceUrl: meetings.sourceUrl,
        status: meetings.status,
      })
      .from(meetings)
      .innerJoin(municipalities, eq(meetings.municipalityCode, municipalities.code))
      .where(eq(meetings.id, input.meetingId))
      .limit(1);

    if (!meeting) continue;

    const statementRows = await db
      .select({
        id: statements.id,
        kind: statements.kind,
        speakerName: statements.speakerName,
        speakerRole: statements.speakerRole,
        content: statements.content,
      })
      .from(statements)
      .where(eq(statements.meetingId, input.meetingId))
      .orderBy(asc(statements.id));

    return {
      ...(meeting as MeetingListItem),
      statements: statementRows as MeetingStatement[],
    };
  }

  throw new Error("Meeting not found");
}
