import { meetings } from "@open-gikai/db";
import { env } from "@open-gikai/env/server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getDb } from "@/lib/server";

const meetingSchema = z.object({
  title: z.string(),
  meetingType: z.string(),
  heldOn: z.string(),
  sourceUrl: z.string().nullable(),
  assemblyLevel: z.enum(["national", "prefectural", "municipal"]),
  prefecture: z.string().nullable(),
  municipality: z.string().nullable(),
  externalId: z.string().nullable(),
  rawText: z.string(),
});

const ingestSchema = z.object({
  meetings: z.array(meetingSchema).min(1).max(500),
});

async function handle({ request }: { request: Request }) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== env.INGEST_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = ingestSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Invalid input", details: result.error.issues },
      { status: 400 }
    );
  }

  const now = new Date();
  const records = result.data.meetings.map((m) => ({
    title: m.title,
    meetingType: m.meetingType,
    heldOn: m.heldOn,
    sourceUrl: m.sourceUrl,
    assemblyLevel: m.assemblyLevel,
    prefecture: m.prefecture,
    municipality: m.municipality,
    externalId: m.externalId,
    rawText: m.rawText,
    status: "pending" as const,
    scrapedAt: now,
  }));

  const db = getDb();
  const inserted = await db
    .insert(meetings)
    .values(records)
    .onConflictDoNothing()
    .returning({ id: meetings.id });

  return Response.json({
    inserted: inserted.length,
    skipped: records.length - inserted.length,
  });
}

export const Route = createFileRoute("/api/ingest/meetings")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
