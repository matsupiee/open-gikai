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
    municipalityCode: string;
    municipalityName: string;
    prefecture: string;
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
    municipality_code: string;
    municipality_name: string;
    prefecture: string;
  }>(sql`
    SELECT
      m.id                    AS id,
      m.title                 AS title,
      m.held_on::text         AS held_on,
      m.meeting_type          AS meeting_type,
      m.topic_digests         AS topic_digests,
      m.municipality_code     AS municipality_code,
      mu.name                 AS municipality_name,
      mu.prefecture           AS prefecture
    FROM meetings m
    INNER JOIN municipalities mu ON mu.code = m.municipality_code
    WHERE m.topic_digests IS NOT NULL
      AND ${existsAnd}
      ${municipalityClause}
    ORDER BY m.held_on DESC, m.id DESC
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
      municipalityCode: r.municipality_code,
      municipalityName: r.municipality_name,
      prefecture: r.prefecture,
      matchedTopicsByQuery,
    };
  });
}

export type TimelineMatchedTopic = {
  topic: string;
  relevance: "primary" | "secondary";
  digest: string;
  speakers: string[];
};

export type TimelineEntry = {
  meetingId: string;
  title: string;
  heldOn: string;
  meetingType: string;
  sourceUrl: string | null;
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  matchedTopics: TimelineMatchedTopic[];
};

/**
 * 特定の議題キーワードに関する会議を時系列昇順で返す（UI のタイムライン描画用）。
 *
 * matchedTopics は該当会議の topic_digests のうち、topic 名か digest 本文に `topic` が含まれるものだけを抽出する。
 */
export async function timelineTopic(
  db: Db,
  args: {
    topic: string;
    municipalityCode?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  },
): Promise<TimelineEntry[]> {
  const limit = args.limit ?? 100;
  const pattern = `%${args.topic}%`;
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
    source_url: string | null;
    municipality_code: string;
    municipality_name: string;
    prefecture: string;
    topic_digests: MeetingTopicDigest[];
  }>(sql`
    SELECT
      m.id                    AS meeting_id,
      m.title                 AS title,
      m.held_on::text         AS held_on,
      m.meeting_type          AS meeting_type,
      m.source_url            AS source_url,
      m.municipality_code     AS municipality_code,
      mu.name                 AS municipality_name,
      mu.prefecture           AS prefecture,
      m.topic_digests         AS topic_digests
    FROM meetings m
    INNER JOIN municipalities mu ON mu.code = m.municipality_code
    WHERE m.topic_digests IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(m.topic_digests) td
        WHERE td->>'topic' ILIKE ${pattern} OR td->>'digest' ILIKE ${pattern}
      )
      ${municipalityClause}
      ${dateFromClause}
      ${dateToClause}
    ORDER BY m.held_on ASC, m.id ASC
    LIMIT ${limit}
  `);

  const lower = args.topic.toLowerCase();
  return rows.map((r) => ({
    meetingId: r.meeting_id,
    title: r.title,
    heldOn: r.held_on,
    meetingType: r.meeting_type,
    sourceUrl: r.source_url,
    municipalityCode: r.municipality_code,
    municipalityName: r.municipality_name,
    prefecture: r.prefecture,
    matchedTopics: r.topic_digests
      .filter(
        (td) =>
          td.topic.toLowerCase().includes(lower) || td.digest.toLowerCase().includes(lower),
      )
      .map((td) => ({
        topic: td.topic,
        relevance: td.relevance,
        digest: td.digest,
        speakers: td.speakers,
      })),
  }));
}
