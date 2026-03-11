import { meetings } from "@open-gikai/db/schema";
import type { MeetingData } from "@open-gikai/scraper";
import type { Db } from "../db";

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
    id: crypto.randomUUID(),
    title: m.title,
    meeting_type: m.meetingType,
    held_on: m.heldOn,
    source_url: m.sourceUrl,
    assembly_level: m.assemblyLevel,
    prefecture: m.prefecture,
    municipality: m.municipality,
    external_id: m.externalId,
    raw_text: m.rawText,
    status: "pending" as const,
    scraped_at: now,
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
