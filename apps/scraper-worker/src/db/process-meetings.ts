import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { meetings, statements } from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";

async function generateEmbedding(
  text: string,
  openaiApiKey: string
): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        input: text.slice(0, 8000),
        model: "text-embedding-3-small",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: [{ embedding: number[] }] };
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/**
 * status="pending" の meetings を statements に変換して保存する。
 * OPENAI_API_KEY が指定された場合は embedding も生成する。
 */
export async function processPendingMeetings(
  db: Db,
  openaiApiKey?: string
): Promise<void> {
  const pendingMeetings = await db
    .select()
    .from(meetings)
    .where(eq(meetings.status, "pending"))
    .limit(100);

  console.log(
    `[process-meetings] Found ${pendingMeetings.length} pending meeting(s)`
  );

  for (const meeting of pendingMeetings) {
    const content = meeting.rawText.trim();

    if (!content) {
      await db
        .update(meetings)
        .set({ status: "processed" })
        .where(eq(meetings.id, meeting.id));
      continue;
    }

    const contentHash = createHash("sha256").update(content).digest("hex");

    let embedding: number[] | null = null;
    if (openaiApiKey) {
      embedding = await generateEmbedding(content, openaiApiKey);
      if (!embedding) {
        console.warn(
          `[process-meetings] Failed to generate embedding for meeting ${meeting.id}`
        );
      }
    }

    try {
      await db
        .insert(statements)
        .values({
          meetingId: meeting.id,
          kind: "speech",
          speakerName: null,
          speakerRole: null,
          content,
          contentHash,
          startOffset: 0,
          endOffset: content.length,
          pageHint: null,
          embedding,
        })
        .onConflictDoNothing();
    } catch (err) {
      console.error(
        `[process-meetings] Failed to insert statement for meeting ${meeting.id}:`,
        err
      );
      continue;
    }

    await db
      .update(meetings)
      .set({ status: "processed" })
      .where(eq(meetings.id, meeting.id));

    console.log(`[process-meetings] Processed meeting ${meeting.id}`);
  }
}
