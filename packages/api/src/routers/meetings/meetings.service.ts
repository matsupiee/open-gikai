import type { Db } from "@open-gikai/db";
import { meetings, municipalities, statements } from "@open-gikai/db/schema";
import { and, asc, desc, eq, gte, inArray, like, lte, lt } from "drizzle-orm";
import { z } from "zod";

import type { meetingsListSchema, meetingStatementsSchema } from "./_schemas";

export interface MeetingListItem {
  id: string;
  title: string;
  heldOn: string;
  prefecture: string;
  municipality: string;
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

function queryMeetings(db: Db, input: z.input<typeof meetingsListSchema>, limit: number) {
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
  if (input.municipalityCodes && input.municipalityCodes.length > 0) {
    conditions.push(inArray(meetings.municipalityCode, input.municipalityCodes));
  }
  if (input.title) conditions.push(like(meetings.title, `%${input.title}%`));
  if (input.cursor) conditions.push(lt(meetings.id, input.cursor));

  const query = db
    .select({
      id: meetings.id,
      title: meetings.title,
      heldOn: meetings.heldOn,
      prefecture: municipalities.prefecture,
      municipality: municipalities.name,
    })
    .from(meetings)
    .innerJoin(municipalities, eq(meetings.municipalityCode, municipalities.code));

  const finalQuery = conditions.length > 0 ? query.where(and(...conditions)) : query;

  return finalQuery.orderBy(desc(meetings.heldOn), desc(meetings.id)).limit(limit);
}

export async function listMeetings(
  db: Db,
  input: z.input<typeof meetingsListSchema>,
): Promise<MeetingsListResponse> {
  const limit = input.limit ?? 20;
  const results = await queryMeetings(db, input, limit + 1);

  const hasMore = results.length > limit;
  const meetingsList = hasMore ? results.slice(0, limit) : results;

  return {
    meetings: meetingsList as MeetingListItem[],
    nextCursor: hasMore ? meetingsList[meetingsList.length - 1]!.id : null,
  };
}

export async function getMeetingStatements(
  db: Db,
  input: z.input<typeof meetingStatementsSchema>,
): Promise<MeetingDetail> {
  const [meeting] = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      heldOn: meetings.heldOn,
      prefecture: municipalities.prefecture,
      municipality: municipalities.name,
    })
    .from(meetings)
    .innerJoin(municipalities, eq(meetings.municipalityCode, municipalities.code))
    .where(eq(meetings.id, input.meetingId))
    .limit(1);

  if (!meeting) {
    throw new Error("Meeting not found");
  }

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
    .orderBy(asc(statements.startOffset));

  return {
    ...(meeting as MeetingListItem),
    statements: statementRows as MeetingStatement[],
  };
}
