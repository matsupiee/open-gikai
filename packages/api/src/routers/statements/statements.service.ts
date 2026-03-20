import type { Db } from "@open-gikai/db";
import { meetings, municipalities, statement_chunks, statements } from "@open-gikai/db";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, ilike, lte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { generateEmbedding } from "../../shared/embedding";
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
    conditions.push(ilike(statements.speakerName, `%${input.speakerName}%`));
  }
  if (input.cursor) {
    conditions.push(lt(statements.id, input.cursor));
  }

  return conditions;
}

export async function searchStatements(
  db: Db,
  input: z.infer<typeof statementsSearchSchema>
): Promise<SearchResponse> {
  const limit = input.limit ?? 20;
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
    .innerJoin(municipalities, eq(meetings.municipalityId, municipalities.id));

  const allConditions = [...statementFilters, ...meetingFilters];

  if (input.q) {
    const terms = input.q.trim().split(/\s+/).filter(Boolean);
    if (terms.length > 0) {
      allConditions.push(
        and(...terms.map((t) => ilike(statements.content, `%${t}%`)))!
      );
    }
  }

  const finalQuery =
    allConditions.length > 0 ? query.where(and(...allConditions)) : query;

  const results = await finalQuery
    .orderBy(desc(statements.createdAt), desc(statements.id))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const statementsList = hasMore ? results.slice(0, limit) : results;

  return {
    statements: statementsList as SearchResult[],
    nextCursor: hasMore ? statementsList[statementsList.length - 1]!.id : null,
  };
}

/**
 * セマンティック検索（意味的類似検索） を行うための関数
 *
 * statement_chunks テーブルを使用する（手続き系除外・スピーカーグループ化済み）。
 * embeddings が事前計算済みのため、HNSW インデックスで高速検索できる。
 */
async function semanticSearchWithEmbedding(
  db: Db,
  input: z.infer<typeof statementsSemanticSearchSchema>
): Promise<SemanticSearchResponse> {
  const queryEmbedding = await generateEmbedding(input.query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const meetingConditions = [];
  if (input.filters?.heldOnFrom) {
    meetingConditions.push(gte(meetings.heldOn, input.filters.heldOnFrom));
  }
  if (input.filters?.heldOnTo) {
    meetingConditions.push(lte(meetings.heldOn, input.filters.heldOnTo));
  }
  if (input.filters?.prefecture) {
    meetingConditions.push(eq(municipalities.prefecture, input.filters.prefecture));
  }
  if (input.filters?.municipality) {
    meetingConditions.push(eq(municipalities.name, input.filters.municipality));
  }

  const allConditions = [
    sql`${statement_chunks.embedding} IS NOT NULL`,
    ...meetingConditions,
  ];

  const query = db
    .select({
      id: statement_chunks.id,
      meetingId: statement_chunks.meetingId,
      kind: sql<string>`CASE
        WHEN ${statement_chunks.speakerRole} IN ('議長', '副議長', '委員長', '副委員長') THEN 'remark'
        WHEN ${statement_chunks.speakerRole} IN ('市長', '副市長', '部長', '副部長', '課長', '副課長', '室長', '市長室長', '局長', '係長', '主任', '補佐', '主査') THEN 'answer'
        ELSE 'question'
      END`,
      speakerName: statement_chunks.speakerName,
      content: statement_chunks.content,
      createdAt: statement_chunks.createdAt,
      meetingTitle: meetings.title,
      heldOn: meetings.heldOn,
      prefecture: municipalities.prefecture,
      municipality: municipalities.name,
      sourceUrl: meetings.sourceUrl,
      similarity: sql<number>`1 - (${statement_chunks.embedding} <=> ${sql.raw(
        `'${embeddingStr}'::vector`
      )})`,
    })
    .from(statement_chunks)
    .innerJoin(meetings, eq(statement_chunks.meetingId, meetings.id))
    .innerJoin(municipalities, eq(meetings.municipalityId, municipalities.id));

  const results = await query
    .where(and(...allConditions))
    .orderBy(
      sql`${statement_chunks.embedding} <=> ${sql.raw(`'${embeddingStr}'::vector`)}`
    )
    .limit(input.topK);

  return { statements: results as SemanticSearchResult[] };
}

async function keywordFallbackSearch(
  db: Db,
  input: z.infer<typeof statementsSemanticSearchSchema>
): Promise<SemanticSearchResponse> {
  const terms = input.query.trim().split(/\s+/).filter(Boolean);
  const conditions = [];

  if (terms.length > 0) {
    conditions.push(and(...terms.map((t) => ilike(statement_chunks.content, `%${t}%`)))!);
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
      id: statement_chunks.id,
      meetingId: statement_chunks.meetingId,
      kind: sql<string>`CASE
        WHEN ${statement_chunks.speakerRole} IN ('議長', '副議長', '委員長', '副委員長') THEN 'remark'
        WHEN ${statement_chunks.speakerRole} IN ('市長', '副市長', '部長', '副部長', '課長', '副課長', '室長', '市長室長', '局長', '係長', '主任', '補佐', '主査') THEN 'answer'
        ELSE 'question'
      END`,
      speakerName: statement_chunks.speakerName,
      content: statement_chunks.content,
      createdAt: statement_chunks.createdAt,
      meetingTitle: meetings.title,
      heldOn: meetings.heldOn,
      prefecture: municipalities.prefecture,
      municipality: municipalities.name,
      sourceUrl: meetings.sourceUrl,
      similarity: sql<number>`0.5`,
    })
    .from(statement_chunks)
    .innerJoin(meetings, eq(statement_chunks.meetingId, meetings.id))
    .innerJoin(municipalities, eq(meetings.municipalityId, municipalities.id));

  const finalQuery = conditions.length > 0 ? query.where(and(...conditions)) : query;

  const results = await finalQuery
    .orderBy(desc(statement_chunks.createdAt), desc(statement_chunks.id))
    .limit(input.topK);

  return { statements: results as SemanticSearchResult[] };
}

export async function semanticSearchStatements(
  db: Db,
  input: z.infer<typeof statementsSemanticSearchSchema>
): Promise<SemanticSearchResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return keywordFallbackSearch(db, input);
  }

  try {
    return await semanticSearchWithEmbedding(db, input);
  } catch (error) {
    console.error("Error in semantic search:", error);
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to perform semantic search",
    });
  }
}

export async function askStatements(
  db: Db,
  input: z.infer<typeof statementsAskSchema>
): Promise<AskResponse> {
  try {
    const { statements: sources } = await semanticSearchStatements(db, {
      query: input.query,
      topK: input.topK ?? 8,
      filters: input.filters,
    });

    if (sources.length === 0) {
      return {
        answer: "関連する発言が見つかりませんでした。検索条件を変えてお試しください。",
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
