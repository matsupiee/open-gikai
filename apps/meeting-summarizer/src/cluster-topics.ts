/**
 * 自治体単位で meetings.topic_digests の topic 文字列を LLM にクラスタリングさせ、
 * 正規化された topics / meeting_topics を作成する。
 *
 * 使い方:
 *   bun run src/cluster-topics.ts -- --municipality 462012
 *   bun run src/cluster-topics.ts -- --municipality 462012 --dry-run
 *   bun run src/cluster-topics.ts -- --municipality 462012 --reset   # 既存の topics/meeting_topics を削除してから再実行
 *   bun run src/cluster-topics.ts -- --municipality 462012 --model gemini-2.5-pro
 *
 * 方針（PoC）:
 * - 自治体内のすべての (meeting_id, digest index) を列挙し、LLM に 1 回で渡してクラスタリングさせる
 * - 1,374 digest / 鹿児島市 なら input ~40k tokens で 2.5 Flash に収まる
 * - 会議数が増えたらバッチ化・増分処理が必要（その時点で再設計）
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { eq, sql } from "drizzle-orm";
import { createDb, type Db } from "@open-gikai/db";
import {
  meetings,
  meetingTopics,
  topics,
  type MeetingTopicDigest,
} from "@open-gikai/db/schema";
import { callWithRetry } from "./retry";

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const DEFAULT_MODEL = "gemini-2.5-flash";

type Args = {
  municipality: string;
  model: string;
  dryRun: boolean;
  reset: boolean;
};

type DigestRef = {
  index: number; // LLM に渡す行番号
  meetingId: string;
  heldOn: string;
  topic: string;
  relevance: "primary" | "secondary";
  digestPreview: string;
};

type Cluster = {
  canonical_name: string;
  description: string;
  member_indices: number[];
};

const CLUSTER_SYSTEM_PROMPT = `あなたは日本の地方議会の議事録から抽出された議題名を、表記ゆれを揃えて「議題マスタ」にまとめるアシスタントです。

入力は (行番号, 議題名, ダイジェスト先頭文) のリストです。
同じ議題を指していると思われるものを 1 クラスタに束ね、代表名 (canonical_name) と短い説明を付けてください。

# クラスタリング方針

- **同一事業・同一政策は 1 クラスタ**:
  - 「市バス路線再編」「市営バス再編」「バス路線の再編成」→ "市バス路線再編"
  - 「桜島火山防災」「桜島の噴火対策」「火山降灰対策」→ "桜島火山防災"
- **粒度**: 元の議題名の具体度を保つ。違う年度の同じ事業は同一視して良い（例: "令和6年度土木費" と "令和7年度土木費"）
- **別事業は別クラスタ**: たとえば「子ども医療費助成」と「保育料改定」は別
- **canonical_name**: 元の表記の中から最も一般性が高く簡潔なものを選ぶ（新語を作らない）
- **description**: 1 文で「どんな議題か」を説明。ダイジェスト先頭文の内容を参照して書く
- **すべての行をどこかのクラスタに割り当てる**。漏れがないようにすること

# 出力

クラスタの配列のみ。余計な文字は出さない。`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clusters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          canonical_name: { type: Type.STRING },
          description: { type: Type.STRING },
          member_indices: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ["canonical_name", "description", "member_indices"],
        propertyOrdering: ["canonical_name", "description", "member_indices"],
      },
    },
  },
  required: ["clusters"],
  propertyOrdering: ["clusters"],
} as const;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");

  const db = createDb(databaseUrl);
  const client = new GoogleGenAI({ apiKey });

  console.error(`[cluster] municipality=${args.municipality} model=${args.model}`);

  const digestRefs = await loadDigestRefs(db, args.municipality);
  console.error(`[cluster] loaded ${digestRefs.length} digests from meetings`);
  if (digestRefs.length === 0) {
    console.error(`[cluster] no digests found — did you run summarize:batch first?`);
    return;
  }

  if (args.reset) {
    console.error(`[cluster] --reset: deleting existing meeting_topics / topics for ${args.municipality}`);
    if (!args.dryRun) {
      await db.execute(sql`
        DELETE FROM meeting_topics
        WHERE topic_id IN (SELECT id FROM topics WHERE municipality_code = ${args.municipality})
      `);
      await db.delete(topics).where(eq(topics.municipalityCode, args.municipality));
    }
  }

  const prompt = buildUserPrompt(digestRefs);
  const promptPreview = prompt.slice(0, 400);
  console.error(`[cluster] prompt preview (first 400 chars):\n${promptPreview}${prompt.length > 400 ? "…" : ""}`);

  console.error(`[cluster] calling ${args.model}…`);
  const startedAt = Date.now();
  const response = await callWithRetry(() =>
    client.models.generateContent({
      model: args.model,
      contents: prompt,
      config: {
        systemInstruction: CLUSTER_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: -1 },
      },
    }),
  );
  const elapsed = (Date.now() - startedAt) / 1000;
  console.error(`[cluster] LLM done in ${elapsed.toFixed(1)}s`);

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");

  const usage = response.usageMetadata;
  console.error(
    `[cluster] tokens: prompt=${usage?.promptTokenCount ?? 0} thoughts=${usage?.thoughtsTokenCount ?? 0} output=${usage?.candidatesTokenCount ?? 0}`,
  );

  const parsed = JSON.parse(text) as { clusters: Cluster[] };
  validateClusterCoverage(parsed.clusters, digestRefs);

  console.error(`[cluster] received ${parsed.clusters.length} clusters`);
  for (const c of parsed.clusters.slice(0, 10)) {
    console.error(`  - ${c.canonical_name}  (${c.member_indices.length} members)`);
  }
  if (parsed.clusters.length > 10) {
    console.error(`  … and ${parsed.clusters.length - 10} more`);
  }

  if (args.dryRun) {
    console.error(`[cluster] dry-run — skipping DB writes`);
    return;
  }

  await writeClusters(db, args.municipality, parsed.clusters, digestRefs);
  console.error(`[cluster] wrote ${parsed.clusters.length} topics + linked meeting_topics`);
}

async function loadDigestRefs(db: Db, municipalityCode: string): Promise<DigestRef[]> {
  const rows = await db.query.meetings.findMany({
    where: eq(meetings.municipalityCode, municipalityCode),
    columns: { id: true, heldOn: true, topicDigests: true },
    orderBy: [meetings.heldOn],
  });

  const refs: DigestRef[] = [];
  let idx = 0;
  for (const m of rows) {
    const digests = (m.topicDigests ?? []) as MeetingTopicDigest[];
    for (const d of digests) {
      refs.push({
        index: idx++,
        meetingId: m.id,
        heldOn: String(m.heldOn),
        topic: d.topic,
        relevance: d.relevance,
        digestPreview: d.digest.slice(0, 120),
      });
    }
  }
  return refs;
}

function buildUserPrompt(refs: DigestRef[]): string {
  const lines = refs.map(
    (r) => `${r.index}\t${r.topic}\t${r.digestPreview.replace(/\s+/g, " ")}`,
  );
  return `以下は自治体 1 つ分の議会議事録から抽出された議題の一覧です。
列は タブ区切りで [行番号 / 議題名 / ダイジェスト先頭120字] です。
表記ゆれを揃えてクラスタリングし、JSON で返してください。

${lines.join("\n")}`;
}

function validateClusterCoverage(clusters: Cluster[], refs: DigestRef[]): void {
  const seen = new Set<number>();
  for (const c of clusters) {
    for (const i of c.member_indices) seen.add(i);
  }
  const missing: number[] = [];
  for (const r of refs) {
    if (!seen.has(r.index)) missing.push(r.index);
  }
  if (missing.length > 0) {
    console.error(
      `[cluster] WARNING: ${missing.length} digests were not assigned to any cluster (indices: ${missing.slice(0, 20).join(",")}${missing.length > 20 ? ",…" : ""})`,
    );
  }
  // 重複割り当ても検出（1 digest → 2 クラスタは警告のみ）
  const assignCount = new Map<number, number>();
  for (const c of clusters) {
    for (const i of c.member_indices) {
      assignCount.set(i, (assignCount.get(i) ?? 0) + 1);
    }
  }
  const dupes = [...assignCount.entries()].filter(([, n]) => n > 1);
  if (dupes.length > 0) {
    console.error(`[cluster] WARNING: ${dupes.length} digests were assigned to multiple clusters (will pick first)`);
  }
}

async function writeClusters(
  db: Db,
  municipalityCode: string,
  clusters: Cluster[],
  refs: DigestRef[],
): Promise<void> {
  // meeting_id ごとに既にどの topic に割り当てたかを覚えて重複 insert を避ける
  const assignedByMeeting = new Map<string, Set<string>>();

  for (const cluster of clusters) {
    const memberRefs = cluster.member_indices
      .map((i) => refs[i])
      .filter((r): r is DigestRef => Boolean(r));
    if (memberRefs.length === 0) continue;

    // 同名の元 topic 文字列を aliases として集める（canonical_name 以外）
    const rawTopics = new Set(memberRefs.map((r) => r.topic));
    rawTopics.delete(cluster.canonical_name);
    const aliases = [...rawTopics];

    // topics に upsert（municipality_code + canonical_name で unique）
    const [topic] = await db
      .insert(topics)
      .values({
        municipalityCode,
        canonicalName: cluster.canonical_name,
        aliases,
        description: cluster.description,
      })
      .onConflictDoUpdate({
        target: [topics.municipalityCode, topics.canonicalName],
        set: {
          aliases,
          description: cluster.description,
        },
      })
      .returning({ id: topics.id });
    if (!topic) throw new Error(`failed to upsert topic ${cluster.canonical_name}`);

    // meeting_topics を bulk insert（同一 meeting で同一 topic 複数の場合は最初のダイジェストを優先）
    const rowsToInsert: Array<{
      meetingId: string;
      topicId: string;
      relevance: "primary" | "secondary";
      digest: string;
    }> = [];
    for (const ref of memberRefs) {
      const assigned = assignedByMeeting.get(ref.meetingId) ?? new Set<string>();
      if (assigned.has(topic.id)) continue;
      assigned.add(topic.id);
      assignedByMeeting.set(ref.meetingId, assigned);
      rowsToInsert.push({
        meetingId: ref.meetingId,
        topicId: topic.id,
        relevance: ref.relevance,
        digest: ref.digestPreview,
      });
    }
    if (rowsToInsert.length > 0) {
      await db
        .insert(meetingTopics)
        .values(rowsToInsert)
        .onConflictDoNothing({
          target: [meetingTopics.meetingId, meetingTopics.topicId],
        });
    }
  }
}

function parseArgs(argv: string[]): Args {
  let municipality: string | undefined;
  let model = DEFAULT_MODEL;
  let dryRun = false;
  let reset = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--municipality") municipality = argv[++i];
    else if (a === "--model") model = argv[++i]!;
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--reset") reset = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!municipality) throw new Error("--municipality is required");
  return { municipality, model, dryRun, reset };
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
