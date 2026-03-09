import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, gte, lte, lt } from "drizzle-orm";
import { z } from "zod";
import { db, meetings, statements } from "@open-gikai/db";
import { processMeeting } from "./_utils/statement-processing";
import type { meetingsListSchema } from "./_schemas";

export interface MeetingWithCount {
  id: string;
  title: string;
  meeting_type: string;
  held_on: string;
  source_url: string | null;
  assembly_level: string;
  prefecture: string | null;
  municipality: string | null;
  external_id: string | null;
  raw_text: string;
  status: string;
  scraped_at: Date | null;
  created_at: Date;
  statementsCount: number;
}

export interface ListMeetingsResponse {
  meetings: MeetingWithCount[];
  nextCursor: string | null;
}

export interface GetMeetingResponse extends MeetingWithCount {}

export interface ProcessMeetingResponse {
  success: boolean;
}

function buildWhereConditions(input: z.infer<typeof meetingsListSchema>) {
  const conditions = [];

  if (input.heldOnFrom) {
    conditions.push(gte(meetings.held_on, input.heldOnFrom));
  }
  if (input.heldOnTo) {
    conditions.push(lte(meetings.held_on, input.heldOnTo));
  }
  if (input.meetingType) {
    conditions.push(eq(meetings.meeting_type, input.meetingType));
  }
  if (input.assemblyLevel) {
    conditions.push(eq(meetings.assembly_level, input.assemblyLevel));
  }
  if (input.prefecture) {
    conditions.push(eq(meetings.prefecture, input.prefecture));
  }
  if (input.municipality) {
    conditions.push(eq(meetings.municipality, input.municipality));
  }
  if (input.cursor) {
    conditions.push(lt(meetings.id, input.cursor));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

async function getStatementsCount(meetingId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(statements)
    .where(eq(statements.meeting_id, meetingId));

  return result[0]?.count ?? 0;
}

export async function listMeetings(
  input: z.infer<typeof meetingsListSchema>
): Promise<ListMeetingsResponse> {
  const limit = input.limit ?? 20;
  const whereConditions = buildWhereConditions(input);

  const results = await db
    .select()
    .from(meetings)
    .where(whereConditions)
    .orderBy(desc(meetings.created_at), desc(meetings.id))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const meetingsList = hasMore ? results.slice(0, limit) : results;

  const meetingsWithCounts = await Promise.all(
    meetingsList.map(async (meeting) => {
      const statementsCount = await getStatementsCount(meeting.id);
      return { ...meeting, statementsCount };
    })
  );

  return {
    meetings: meetingsWithCounts as MeetingWithCount[],
    nextCursor: hasMore ? meetingsList[meetingsList.length - 1]!.id : null,
  };
}

export async function getMeeting(id: string): Promise<GetMeetingResponse> {
  const result = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, id));

  if (!result || result.length === 0) {
    throw new ORPCError("NOT_FOUND", {
      message: `Meeting not found: ${id}`,
    });
  }

  const meeting = result[0]!;
  const statementsCount = await getStatementsCount(meeting.id);

  return { ...meeting, statementsCount } as GetMeetingResponse;
}

export async function triggerProcessMeeting(
  id: string
): Promise<ProcessMeetingResponse> {
  const result = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, id));

  if (!result || result.length === 0) {
    throw new ORPCError("NOT_FOUND", {
      message: `Meeting not found: ${id}`,
    });
  }

  processMeeting(id).catch((error) => {
    console.error(`Failed to process meeting ${id}:`, error);
  });

  return { success: true };
}
