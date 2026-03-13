import type { Db } from "@open-gikai/db";
import { meetings } from "@open-gikai/db/schema";
import type { MeetingData } from "./types";

/**
 * MeetingData 配列を DB に upsert する。
 * external_id の重複はスキップ (onConflictDoNothing)。
 * Returns: { inserted, skipped }
 */
export async function saveMeetings(
  db: Db,
  records: MeetingData[]
): Promise<{ inserted: number; skipped: number }> {
  if (records.length === 0) return { inserted: 0, skipped: 0 };

  const now = new Date();
  const rows = records.map((m) => ({
    municipalityId: m.municipalityId,
    title: m.title,
    meetingType: m.meetingType,
    heldOn: m.heldOn,
    sourceUrl: m.sourceUrl,
    externalId: m.externalId,
    rawText: m.rawText,
    status: "pending" as const,
    scrapedAt: now,
  }));

  const inserted = await db
    .insert(meetings)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: meetings.id });

  return {
    inserted: inserted.length,
    skipped: rows.length - inserted.length,
  };
}
