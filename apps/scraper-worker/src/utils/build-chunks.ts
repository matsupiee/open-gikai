import { createHash } from "node:crypto";
import { asc, eq, inArray, notExists } from "drizzle-orm";
import { meetings, statements, statement_chunks } from "@open-gikai/db/schema";
import { createId } from "@paralleldrive/cuid2";
import type { Db } from "@open-gikai/db";
import { buildChunksFromStatements } from "./statement-chunking";

const EMBEDDING_BATCH_SIZE = 20;

async function generateEmbeddingsBatch(
  texts: string[],
  openaiApiKey: string
): Promise<(number[] | null)[]> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        input: texts.map((t) => t.slice(0, 8000)),
        model: "text-embedding-3-small",
      }),
    });
    if (!res.ok) return texts.map(() => null);
    const data = (await res.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    const result: (number[] | null)[] = texts.map(() => null);
    for (const item of data.data) {
      result[item.index] = item.embedding;
    }
    return result;
  } catch {
    return texts.map(() => null);
  }
}

/**
 * 指定会議の statement_chunks を再構築する。
 *
 * 処理手順:
 * 1. 会議の全発言を取得（startOffset 順）
 * 2. isProcedural フィルタ + スピーカーグループ化 + チャンク分割
 * 3. 既存チャンクを削除
 * 4. バッチで embedding 生成 & 挿入
 */
export async function buildChunksForMeeting(
  db: Db,
  meetingId: string,
  openaiApiKey?: string
): Promise<{ inserted: number }> {
  const stmts = await db
    .select({
      id: statements.id,
      speakerName: statements.speakerName,
      speakerRole: statements.speakerRole,
      content: statements.content,
    })
    .from(statements)
    .where(eq(statements.meetingId, meetingId))
    .orderBy(asc(statements.startOffset), asc(statements.id));

  if (stmts.length === 0) return { inserted: 0 };

  const chunkInputs = buildChunksFromStatements(stmts);
  if (chunkInputs.length === 0) return { inserted: 0 };

  // 既存チャンクを削除（再スクレイプ時の冪等性を保証）
  await db
    .delete(statement_chunks)
    .where(eq(statement_chunks.meetingId, meetingId));

  let inserted = 0;

  for (let i = 0; i < chunkInputs.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunkInputs.slice(i, i + EMBEDDING_BATCH_SIZE);

    let embeddings: (number[] | null)[] = batch.map(() => null);
    if (openaiApiKey) {
      embeddings = await generateEmbeddingsBatch(
        batch.map((c) => c.content),
        openaiApiKey
      );
    }

    const rows = batch.map((chunk, j) => ({
      id: createId(),
      meetingId,
      speakerName: chunk.speakerName,
      speakerRole: chunk.speakerRole,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      contentHash: createHash("sha256").update(chunk.content).digest("hex"),
      embedding: embeddings[j] ?? null,
      // statementIds はチャンク挿入後に statements.chunkId へ反映するため保持
      _statementIds: chunk.statementIds,
    }));

    await db
      .insert(statement_chunks)
      .values(rows.map(({ _statementIds: _, ...row }) => row))
      .onConflictDoNothing();

    // 各 statement に chunkId をセット
    for (const row of rows) {
      if (row._statementIds.length > 0) {
        await db
          .update(statements)
          .set({ chunkId: row.id })
          .where(inArray(statements.id, row._statementIds));
      }
    }

    inserted += rows.length;
  }

  return { inserted };
}

/**
 * statement_chunks がまだ作られていない processed 会議を一括処理する。
 * バックフィル（既存データへの適用）に使用する。
 */
export async function buildPendingChunks(
  db: Db,
  openaiApiKey?: string,
  limit = 50
): Promise<void> {
  // statement_chunks が存在しない processed 会議を取得
  const pendingMeetings = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(
      notExists(
        db
          .select({ id: statement_chunks.id })
          .from(statement_chunks)
          .where(eq(statement_chunks.meetingId, meetings.id))
      )
    )
    .limit(limit);

  console.log(`[build-chunks] ${pendingMeetings.length} meeting(s) to process`);

  for (const meeting of pendingMeetings) {
    const { inserted } = await buildChunksForMeeting(
      db,
      meeting.id,
      openaiApiKey
    );
    console.log(`[build-chunks] meeting=${meeting.id} → ${inserted} chunk(s)`);
  }
}
