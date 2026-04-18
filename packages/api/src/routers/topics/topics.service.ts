/**
 * 議題ベース検索のサービス層。DB の meetings.topic_digests を対象とする。
 *
 * Postgres の jsonb_array_elements を使って「topic_digests の中に〇〇にマッチする topic がある meeting」
 * を効率的に引く。
 */

import { sql } from "drizzle-orm";
import type { Db } from "@open-gikai/db";
import type { MeetingTopicDigest } from "@open-gikai/db/schema";

export type MatchedTopicRow = {
  meetingId: string;
  title: string;
  heldOn: string;
  meetingType: string;
  matchedTopic: string;
  relevance: "primary" | "secondary";
  digestPreview: string;
};

/**
 * topic 名・digest 本文・会議全体サマリのいずれかに query が含まれる meeting を新しい順で返す。
 *
 * 返す行は (meeting, 該当 topic) の組。同じ会議に複数ヒットした場合は複数行になる。
 */
export async function searchTopics(
  db: Db,
  args: {
    query: string;
    municipalityCode?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  },
): Promise<MatchedTopicRow[]> {
  const limit = args.limit ?? 30;
  const pattern = `%${args.query}%`;
  const municipalityClause = args.municipalityCode
    ? sql`AND m.municipality_code = ${args.municipalityCode}`
    : sql``;
  const dateFromClause = args.dateFrom ? sql`AND m.held_on >= ${args.dateFrom}` : sql``;
  const dateToClause = args.dateTo ? sql`AND m.held_on <= ${args.dateTo}` : sql``;

  const rows = await db.execute<{
    meeting_id: string;
    title: string;
    held_on: string;
    meeting_type: string;
    matched_topic: string;
    relevance: "primary" | "secondary";
    digest_preview: string;
  }>(sql`
    SELECT
      m.id                                      AS meeting_id,
      m.title                                   AS title,
      m.held_on::text                           AS held_on,
      m.meeting_type                            AS meeting_type,
      td->>'topic'                              AS matched_topic,
      (td->>'relevance')::text                  AS relevance,
      left(td->>'digest', 200)                  AS digest_preview
    FROM meetings m
    CROSS JOIN LATERAL jsonb_array_elements(m.topic_digests) td
    WHERE m.topic_digests IS NOT NULL
      AND (
        td->>'topic' ILIKE ${pattern}
        OR td->>'digest' ILIKE ${pattern}
        OR m.summary ILIKE ${pattern}
      )
      ${municipalityClause}
      ${dateFromClause}
      ${dateToClause}
    ORDER BY m.held_on DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    meetingId: r.meeting_id,
    title: r.title,
    heldOn: r.held_on,
    meetingType: r.meeting_type,
    matchedTopic: r.matched_topic,
    relevance: r.relevance,
    digestPreview: r.digest_preview,
  }));
}

export type MeetingDigest = {
  meetingId: string;
  title: string;
  heldOn: string;
  meetingType: string;
  sourceUrl: string | null;
  summary: string | null;
  topicDigests: MeetingTopicDigest[];
};

/**
 * meeting の全サマリ情報を返す（summary + topic_digests）。
 */
export async function getMeetingDigest(db: Db, meetingId: string): Promise<MeetingDigest | null> {
  const rows = await db.execute<{
    id: string;
    title: string;
    held_on: string;
    meeting_type: string;
    source_url: string | null;
    summary: string | null;
    topic_digests: MeetingTopicDigest[] | null;
  }>(sql`
    SELECT id, title, held_on::text AS held_on, meeting_type, source_url, summary, topic_digests
    FROM meetings
    WHERE id = ${meetingId}
    LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    meetingId: r.id,
    title: r.title,
    heldOn: r.held_on,
    meetingType: r.meeting_type,
    sourceUrl: r.source_url,
    summary: r.summary,
    topicDigests: r.topic_digests ?? [],
  };
}

/**
 * 複数の topic query のすべてにマッチする meeting を返す（関連分析用）。
 *
 * 例: ["市バス路線再編", "ICカード"] を渡すと、両方の議論が含まれている会議を返す。
 */
export async function findMeetingsWithTopics(
  db: Db,
  args: {
    topics: string[];
    municipalityCode?: string;
    limit?: number;
  },
): Promise<
  Array<{
    meetingId: string;
    title: string;
    heldOn: string;
    meetingType: string;
    matchedTopicsByQuery: Record<string, string[]>;
  }>
> {
  if (args.topics.length === 0) return [];
  const limit = args.limit ?? 20;

  // 各 topic query ごとの EXISTS サブクエリを AND 結合
  const existsClauses = args.topics.map(
    (q) => sql`EXISTS (
      SELECT 1 FROM jsonb_array_elements(m.topic_digests) td
      WHERE td->>'topic' ILIKE ${`%${q}%`} OR td->>'digest' ILIKE ${`%${q}%`}
    )`,
  );
  const existsAnd = sql.join(existsClauses, sql` AND `);

  const municipalityClause = args.municipalityCode
    ? sql`AND m.municipality_code = ${args.municipalityCode}`
    : sql``;

  const rows = await db.execute<{
    id: string;
    title: string;
    held_on: string;
    meeting_type: string;
    topic_digests: MeetingTopicDigest[];
  }>(sql`
    SELECT id, title, held_on::text AS held_on, meeting_type, topic_digests
    FROM meetings m
    WHERE topic_digests IS NOT NULL
      AND ${existsAnd}
      ${municipalityClause}
    ORDER BY held_on DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => {
    const matchedTopicsByQuery: Record<string, string[]> = {};
    for (const q of args.topics) {
      const lower = q.toLowerCase();
      matchedTopicsByQuery[q] = r.topic_digests
        .filter(
          (td) =>
            td.topic.toLowerCase().includes(lower) || td.digest.toLowerCase().includes(lower),
        )
        .map((td) => td.topic);
    }
    return {
      meetingId: r.id,
      title: r.title,
      heldOn: r.held_on,
      meetingType: r.meeting_type,
      matchedTopicsByQuery,
    };
  });
}
