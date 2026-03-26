import type { Db } from "@open-gikai/db";
import {
  meetings,
  municipalities,
  statements,
} from "@open-gikai/db/schema";
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

function buildMeetingFilters(input: z.input<typeof statementsSearchSchema>) {
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

function buildStatementFilters(input: z.input<typeof statementsSearchSchema>) {
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

/**
 * PostgreSQL tsvector を使った全文検索条件を構築する。
 * 入力をスペース区切りで分割し、各トークンを plainto_tsquery で AND 検索する。
 */
function buildFtsCondition(q: string) {
  const trimmed = q.trim();
  if (!trimmed) return null;
  return sql`${statements.contentTsv} @@ plainto_tsquery('simple', ${trimmed})`;
}

function queryStatements(
  db: Db,
  input: z.input<typeof statementsSearchSchema>,
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
    const ftsCondition = buildFtsCondition(input.q);
    if (ftsCondition) {
      allConditions.push(ftsCondition);
    }
  }

  const finalQuery =
    allConditions.length > 0 ? query.where(and(...allConditions)) : query;

  return finalQuery
    .orderBy(desc(statements.createdAt), desc(statements.id))
    .limit(limit);
}

export async function searchStatements(
  db: Db,
  input: z.input<typeof statementsSearchSchema>,
): Promise<SearchResponse> {
  const limit = input.limit ?? 20;
  const results = await queryStatements(db, input, limit + 1);

  const hasMore = results.length > limit;
  const statementsList = hasMore ? results.slice(0, limit) : results;

  return {
    statements: statementsList as SearchResult[],
    nextCursor: hasMore ? statementsList[statementsList.length - 1]!.id : null,
  };
}

function querySemanticStatements(
  db: Db,
  input: z.input<typeof statementsSemanticSearchSchema>,
) {
  const conditions = [];

  const ftsCondition = buildFtsCondition(input.query);
  if (ftsCondition) {
    conditions.push(ftsCondition);
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
    .limit(input.topK ?? 5);
}

export async function semanticSearchStatements(
  db: Db,
  input: z.input<typeof statementsSemanticSearchSchema>,
): Promise<SemanticSearchResponse> {
  const results = await querySemanticStatements(db, input);
  return { statements: results as SemanticSearchResult[] };
}

export async function askStatements(
  db: Db,
  input: z.input<typeof statementsAskSchema>,
): Promise<AskResponse> {
  try {
    const { statements: sources } = await semanticSearchStatements(db, {
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
