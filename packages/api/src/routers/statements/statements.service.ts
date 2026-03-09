import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, ilike, lte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, meetings, statements } from "@open-gikai/db";
import { generateEmbedding } from "../../shared/embedding";
import type {
  statementsSearchSchema,
  statementsSemanticSearchSchema,
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
  prefecture: string | null;
  municipality: string | null;
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

function buildMeetingFilters(input: z.infer<typeof statementsSearchSchema>) {
  const conditions = [];

  if (input.heldOnFrom) {
    conditions.push(gte(meetings.held_on, input.heldOnFrom));
  }
  if (input.heldOnTo) {
    conditions.push(lte(meetings.held_on, input.heldOnTo));
  }
  if (input.prefecture) {
    conditions.push(eq(meetings.prefecture, input.prefecture));
  }
  if (input.municipality) {
    conditions.push(eq(meetings.municipality, input.municipality));
  }
  if (input.assemblyLevel) {
    conditions.push(eq(meetings.assembly_level, input.assemblyLevel));
  }

  return conditions;
}

function buildStatementFilters(input: z.infer<typeof statementsSearchSchema>) {
  const conditions = [];

  if (input.kind) {
    conditions.push(eq(statements.kind, input.kind));
  }
  if (input.speakerName) {
    conditions.push(ilike(statements.speaker_name, `%${input.speakerName}%`));
  }
  if (input.cursor) {
    conditions.push(lt(statements.id, input.cursor));
  }

  return conditions;
}

export async function searchStatements(
  input: z.infer<typeof statementsSearchSchema>
): Promise<SearchResponse> {
  const limit = input.limit ?? 20;
  const meetingFilters = buildMeetingFilters(input);
  const statementFilters = buildStatementFilters(input);

  const query = db
    .select({
      id: statements.id,
      meetingId: statements.meeting_id,
      kind: statements.kind,
      speakerName: statements.speaker_name,
      content: statements.content,
      createdAt: statements.created_at,
      meetingTitle: meetings.title,
      heldOn: meetings.held_on,
      prefecture: meetings.prefecture,
      municipality: meetings.municipality,
      sourceUrl: meetings.source_url,
    })
    .from(statements)
    .innerJoin(meetings, eq(statements.meeting_id, meetings.id));

  const allConditions = [...statementFilters, ...meetingFilters];

  if (input.q) {
    const searchQuery = input.q.replace(/\s+/g, " ").trim();
    allConditions.push(
      sql`${statements.content_tsv} @@ to_tsquery('simple', ${searchQuery})`
    );
  }

  const finalQuery =
    allConditions.length > 0 ? query.where(and(...allConditions)) : query;

  const results = await finalQuery
    .orderBy(desc(statements.created_at), desc(statements.id))
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
 * 入力：検索クエリ（文字列）
 * 出力：類似度の高い発言リスト
 *
 * 流れ
 * 1. 検索クエリをベクトル化
 * 2. ベクトル化した検索クエリとstatementsテーブルのembeddingを比較
 * 3. 類似度の高い順に発言を返す
 *
 * 類似度の計算は、ベクトルの内積をとることで行う
 */
export async function semanticSearchStatements(
  input: z.infer<typeof statementsSemanticSearchSchema>
): Promise<SemanticSearchResponse> {
  try {
    const queryEmbedding = await generateEmbedding(input.query);
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    const meetingConditions = [];
    if (input.filters?.heldOnFrom) {
      meetingConditions.push(gte(meetings.held_on, input.filters.heldOnFrom));
    }
    if (input.filters?.heldOnTo) {
      meetingConditions.push(lte(meetings.held_on, input.filters.heldOnTo));
    }
    if (input.filters?.prefecture) {
      meetingConditions.push(eq(meetings.prefecture, input.filters.prefecture));
    }
    if (input.filters?.municipality) {
      meetingConditions.push(
        eq(meetings.municipality, input.filters.municipality)
      );
    }
    if (input.filters?.assemblyLevel) {
      meetingConditions.push(
        eq(meetings.assembly_level, input.filters.assemblyLevel)
      );
    }

    const allConditions = [
      sql`${statements.embedding} IS NOT NULL`,
      ...meetingConditions,
    ];

    const query = db
      .select({
        id: statements.id,
        meetingId: statements.meeting_id,
        kind: statements.kind,
        speakerName: statements.speaker_name,
        content: statements.content,
        createdAt: statements.created_at,
        meetingTitle: meetings.title,
        heldOn: meetings.held_on,
        prefecture: meetings.prefecture,
        municipality: meetings.municipality,
        sourceUrl: meetings.source_url,
        similarity: sql<number>`1 - (${statements.embedding} <=> ${sql.raw(
          `'${embeddingStr}'::vector`
        )})`,
      })
      .from(statements)
      .innerJoin(meetings, eq(statements.meeting_id, meetings.id));

    const results = await query
      .where(and(...allConditions))
      .orderBy(
        // <=> 演算子 は pgvector のコサイン距離演算子
        // 距離が小さい順にソートする
        sql`${statements.embedding} <=> ${sql.raw(`'${embeddingStr}'::vector`)}`
      )
      .limit(input.topK);

    return { statements: results as SemanticSearchResult[] };
  } catch (error) {
    console.error("Error in semantic search:", error);
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to perform semantic search",
    });
  }
}
