import type { Db, ShardedMinutesDb } from "@open-gikai/db-minutes";
import { meetings, municipalities, statements } from "@open-gikai/db-minutes";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, like, lte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { generateAnswer } from "../../shared/llm";
import type {
  statementsSearchSchema,
  statementsSemanticSearchSchema,
  statementsAskSchema,
} from "./_schemas";

export interface SearchResult {
  id: string;
  meetingId: string;
  kind: string;
  speakerName: string | null;
  content: string;
  createdAt: Date;
  meetingTitle: string;
  heldOn: string;
  prefecture: string;
  municipality: string;
  sourceUrl: string | null;
}

export interface SemanticSearchResult extends SearchResult {
  similarity: number;
}

export interface SearchResponse {
  statements: SearchResult[];
  nextCursor: string | null;
}

export interface SemanticSearchResponse {
  statements: SemanticSearchResult[];
}

export interface AskResponse {
  answer: string;
  sources: SemanticSearchResult[];
}

function buildMeetingFilters(input: z.infer<typeof statementsSearchSchema>) {
  const conditions = [];

  if (input.heldOnFrom) {
    conditions.push(gte(meetings.heldOn, input.heldOnFrom));
  }
  if (input.heldOnTo) {
    conditions.push(lte(meetings.heldOn, input.heldOnTo));
  }
  if (input.prefecture) {
    conditions.push(eq(municipalities.prefecture, input.prefecture));
  }
  if (input.municipality) {
    conditions.push(eq(municipalities.name, input.municipality));
  }

  return conditions;
}

function buildStatementFilters(input: z.infer<typeof statementsSearchSchema>) {
  const conditions = [];

  if (input.kind) {
    conditions.push(eq(statements.kind, input.kind));
  }
  if (input.speakerName) {
    conditions.push(like(statements.speakerName, `%${input.speakerName}%`));
  }
  if (input.cursor) {
    conditions.push(lt(statements.id, input.cursor));
  }

  return conditions;
}

function queryStatementsFromShard(
  db: Db,
  input: z.infer<typeof statementsSearchSchema>,
  limit: number,
) {
  const meetingFilters = buildMeetingFilters(input);
  const statementFilters = buildStatementFilters(input);

  const query = db
    .select({
      id: statements.id,
      meetingId: statements.meetingId,
      kind: statements.kind,
      speakerName: statements.speakerName,
      content: statements.content,
      createdAt: statements.createdAt,
      meetingTitle: meetings.title,
      heldOn: meetings.heldOn,
      prefecture: municipalities.prefecture,
      municipality: municipalities.name,
      sourceUrl: meetings.sourceUrl,
    })
    .from(statements)
    .innerJoin(meetings, eq(statements.meetingId, meetings.id))
    .innerJoin(municipalities, eq(meetings.municipalityCode, municipalities.code));

  const allConditions = [...statementFilters, ...meetingFilters];

  if (input.q) {
    const terms = input.q.trim().split(/\s+/).filter(Boolean);
    if (terms.length > 0) {
      allConditions.push(
        and(...terms.map((t) => like(statements.content, `%${t}%`)))!,
      );
    }
  }

  const finalQuery =
    allConditions.length > 0 ? query.where(and(...allConditions)) : query;

  return finalQuery
    .orderBy(desc(statements.createdAt), desc(statements.id))
    .limit(limit);
}

export async function searchStatements(
  shardedDb: ShardedMinutesDb,
  input: z.infer<typeof statementsSearchSchema>,
): Promise<SearchResponse> {
  const limit = input.limit ?? 20;
  const dbs = shardedDb.getRelevantDbs({
    heldOnFrom: input.heldOnFrom,
    heldOnTo: input.heldOnTo,
    prefecture: input.prefecture,
  });

  const allResults: SearchResult[] = [];
  for (const db of dbs) {
    const results = await queryStatementsFromShard(db, input, limit + 1);
    allResults.push(...(results as SearchResult[]));
  }

  allResults.sort((a, b) => {
    const cmp = b.createdAt.getTime() - a.createdAt.getTime();
    if (cmp !== 0) return cmp;
    return b.id.localeCompare(a.id);
  });

  const hasMore = allResults.length > limit;
  const statementsList = hasMore ? allResults.slice(0, limit) : allResults;

  return {
    statements: statementsList,
    nextCursor: hasMore ? statementsList[statementsList.length - 1]!.id : null,
  };
}

function querySemanticFromShard(
  db: Db,
  input: z.infer<typeof statementsSemanticSearchSchema>,
) {
  const terms = input.query.trim().split(/\s+/).filter(Boolean);
  const conditions = [];

  if (terms.length > 0) {
    conditions.push(
      and(...terms.map((t) => like(statements.content, `%${t}%`)))!,
    );
  }
  if (input.filters?.heldOnFrom) {
    conditions.push(gte(meetings.heldOn, input.filters.heldOnFrom));
  }
  if (input.filters?.heldOnTo) {
    conditions.push(lte(meetings.heldOn, input.filters.heldOnTo));
  }
  if (input.filters?.prefecture) {
    conditions.push(eq(municipalities.prefecture, input.filters.prefecture));
  }
  if (input.filters?.municipality) {
    conditions.push(eq(municipalities.name, input.filters.municipality));
  }

  const query = db
    .select({
      id: statements.id,
      meetingId: statements.meetingId,
      kind: statements.kind,
      speakerName: statements.speakerName,
      content: statements.content,
      createdAt: statements.createdAt,
      meetingTitle: meetings.title,
      heldOn: meetings.heldOn,
      prefecture: municipalities.prefecture,
      municipality: municipalities.name,
      sourceUrl: meetings.sourceUrl,
      similarity: sql<number>`0.5`,
    })
    .from(statements)
    .innerJoin(meetings, eq(statements.meetingId, meetings.id))
    .innerJoin(
      municipalities,
      eq(meetings.municipalityCode, municipalities.code),
    );

  const finalQuery =
    conditions.length > 0 ? query.where(and(...conditions)) : query;

  return finalQuery
    .orderBy(desc(statements.createdAt), desc(statements.id))
    .limit(input.topK);
}

export async function semanticSearchStatements(
  shardedDb: ShardedMinutesDb,
  input: z.infer<typeof statementsSemanticSearchSchema>,
): Promise<SemanticSearchResponse> {
  const dbs = shardedDb.getRelevantDbs({
    heldOnFrom: input.filters?.heldOnFrom,
    heldOnTo: input.filters?.heldOnTo,
    prefecture: input.filters?.prefecture,
  });

  const allResults: SemanticSearchResult[] = [];
  for (const db of dbs) {
    const results = await querySemanticFromShard(db, input);
    allResults.push(...(results as SemanticSearchResult[]));
  }

  allResults.sort((a, b) => {
    const cmp = b.createdAt.getTime() - a.createdAt.getTime();
    if (cmp !== 0) return cmp;
    return b.id.localeCompare(a.id);
  });

  return { statements: allResults.slice(0, input.topK) };
}

export async function askStatements(
  shardedDb: ShardedMinutesDb,
  input: z.infer<typeof statementsAskSchema>,
): Promise<AskResponse> {
  try {
    const { statements: sources } = await semanticSearchStatements(shardedDb, {
      query: input.query,
      topK: input.topK ?? 8,
      filters: input.filters,
    });

    if (sources.length === 0) {
      return {
        answer:
          "関連する発言が見つかりませんでした。検索条件を変えてお試しください。",
        sources: [],
      };
    }

    const answer = await generateAnswer(input.query, sources);

    return { answer, sources };
  } catch (error) {
    console.error("Error in ask:", error);
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to generate answer",
    });
  }
}
