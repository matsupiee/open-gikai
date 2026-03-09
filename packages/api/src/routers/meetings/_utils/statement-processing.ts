import { createHash, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, meetings, statements } from "@open-gikai/db";
import { generateEmbeddings } from "../../../shared/embedding";

export type StatementKind = "question" | "answer" | "remark" | "unknown";

export interface StatementChunk {
  speakerName: string | null;
  speakerRole: string | null;
  kind: StatementKind;
  content: string;
  contentHash: string;
  startOffset: number;
  endOffset: number;
}

const POSITIONS_WITH_AUTHORITY = [
  "市長",
  "知事",
  "部長",
  "課長",
  "局長",
  "大臣",
  "副大臣",
  "長官",
];

const POSITIONS_WITH_REMARK = ["議長", "委員長", "議員", "番"];

function extractSpeakerInfo(headerText: string): {
  name: string | null;
  role: string | null;
} {
  const cleaned = headerText.replace(/^○/, "").trim();

  const roleMatch = cleaned.match(/^(.+?)（(.+?)）$/);
  if (roleMatch && roleMatch[1] && roleMatch[2]) {
    return {
      name: roleMatch[1].trim(),
      role: roleMatch[2].trim(),
    };
  }

  return {
    name: cleaned,
    role: null,
  };
}

/**
 * 発言の種別を推定する
 *
 * 発言者名に市長、知事、部長、課長、局長、大臣、副大臣、長官が含まれている場合は答弁
 * 発言者名に議長、委員長、議員、番が含まれている場合は一般発言
 * それ以外は不明
 */
function determineKind(speakerName: string | null): StatementKind {
  if (!speakerName) {
    return "unknown";
  }

  if (POSITIONS_WITH_AUTHORITY.some((pos) => speakerName.includes(pos))) {
    return "answer";
  }

  if (POSITIONS_WITH_REMARK.some((pos) => speakerName.includes(pos))) {
    return "remark";
  }

  return "unknown";
}

function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * 議事録の生テキストを分割する
 *
 * ○発言者名： で分割する
 * 発言者名は発言者の名前と役職を含む
 * 発言者名の後ろには発言内容が続く
 * 発言内容は発言者の名前と役職を含む
 * 発言内容は発言者の名前と役職を含む
 */
export function splitIntoStatements(rawText: string): StatementChunk[] {
  const pattern = /(^|\n)○([^\n　]+)[　\n]/gm;
  const chunks: StatementChunk[] = [];
  const matches = Array.from(rawText.matchAll(pattern));

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const headerStart = match.index! + (match[1] ? 1 : 0);
    const contentStart = match.index! + match[0].length;

    const nextMatch = matches[i + 1];
    const contentEnd = nextMatch
      ? nextMatch.index! + (nextMatch[1] ? 1 : 0)
      : rawText.length;

    const content = rawText
      .substring(contentStart, contentEnd)
      .trim()
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ");

    if (content.length < 10) {
      continue;
    }

    const speakerInfo = extractSpeakerInfo("○" + (match[2] ?? ""));
    const kind = determineKind(speakerInfo.name);
    const contentHash = computeContentHash(content);

    chunks.push({
      speakerName: speakerInfo.name,
      speakerRole: speakerInfo.role,
      kind,
      content,
      contentHash,
      startOffset: headerStart,
      endOffset: contentEnd,
    });
  }

  return chunks;
}

/**
 * DBからmeetingデータを取得
 * 分割してembeddingを生成してstatementsテーブルに保存
 */
export async function processMeeting(
  meetingId: string,
  database?: typeof db
): Promise<void> {
  const targetDb = database || db;

  try {
    const meeting = await targetDb
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));

    if (!meeting || meeting.length === 0) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    const meetingRecord = meeting[0]!;
    if (!meetingRecord.raw_text) {
      throw new Error(`No raw_text found for meeting: ${meetingId}`);
    }

    await targetDb
      .update(meetings)
      .set({ status: "processing" })
      .where(eq(meetings.id, meetingId));

    const chunks = splitIntoStatements(meetingRecord.raw_text);

    if (chunks.length === 0) {
      await targetDb
        .update(meetings)
        .set({ status: "done" })
        .where(eq(meetings.id, meetingId));
      return;
    }

    const BATCH_SIZE = 50;
    const embeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await generateEmbeddings(
        batch.map((c) => c.content)
      );
      embeddings.push(...batchEmbeddings);
    }

    const records = chunks.map((chunk, index) => ({
      id: randomUUID(),
      meeting_id: meetingId,
      kind: chunk.kind,
      speaker_name: chunk.speakerName,
      speaker_role: chunk.speakerRole,
      content: chunk.content,
      content_hash: chunk.contentHash,
      start_offset: chunk.startOffset,
      end_offset: chunk.endOffset,
      embedding: embeddings[index],
      page_hint: null,
    }));

    if (records.length > 0) {
      await targetDb
        .insert(statements)
        .values(records)
        .onConflictDoNothing({
          target: [statements.meeting_id, statements.content_hash],
        });
    }

    await targetDb
      .update(meetings)
      .set({ status: "done" })
      .where(eq(meetings.id, meetingId));
  } catch (error) {
    try {
      await targetDb
        .update(meetings)
        .set({ status: "failed" })
        .where(eq(meetings.id, meetingId));
    } catch {
      // Ignore errors during cleanup
    }
    throw error;
  }
}
