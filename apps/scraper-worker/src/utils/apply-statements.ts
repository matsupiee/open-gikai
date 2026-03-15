/**
 * ParsedStatement 配列を DB に挿入し、meeting を "processed" に更新する。
 *
 * 各 system type の to-statements.ts が生成した ParsedStatement を受け取り、
 * statements テーブルへの挿入・meeting ステータス更新・statement_chunks 構築を行う。
 */

import { eq } from "drizzle-orm";
import { meetings, statements } from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import type { ParsedStatement } from "./types";
import { buildChunksForMeeting } from "./build-chunks";

export async function applyStatementsToMeeting(
  db: Db,
  meetingId: string,
  parsedStatements: ParsedStatement[],
  openaiApiKey?: string
): Promise<void> {
  if (parsedStatements.length === 0) {
    await db
      .update(meetings)
      .set({ status: "processed" })
      .where(eq(meetings.id, meetingId));
    return;
  }

  let hasError = false;

  for (const s of parsedStatements) {
    try {
      await db
        .insert(statements)
        .values({
          meetingId,
          kind: s.kind,
          speakerName: s.speakerName,
          speakerRole: s.speakerRole,
          content: s.content,
          contentHash: s.contentHash,
          startOffset: s.startOffset,
          endOffset: s.endOffset,
        })
        .onConflictDoNothing();
    } catch (err) {
      console.error(
        `[apply-statements] Failed to insert statement for meeting ${meetingId}:`,
        err
      );
      hasError = true;
      break;
    }
  }

  if (hasError) return;

  await db
    .update(meetings)
    .set({ status: "processed" })
    .where(eq(meetings.id, meetingId));

  const { inserted: chunksInserted } = await buildChunksForMeeting(
    db,
    meetingId,
    openaiApiKey
  );

  console.log(
    `[apply-statements] meeting ${meetingId} → ${parsedStatements.length} statement(s), ${chunksInserted} chunk(s)`
  );
}
