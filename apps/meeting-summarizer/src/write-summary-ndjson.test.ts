import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendSummaryRow } from "./write-summary-ndjson";

describe("appendSummaryRow", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "summaries-ndjson-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("heldOn の年/自治体コードのディレクトリに summaries.ndjson を追記する", async () => {
    await appendSummaryRow(dataDir, {
      meetingId: "m-1",
      municipalityCode: "462012",
      heldOn: "2024-03-15",
      summary: "本会議のサマリ",
      topicDigests: [
        { topic: "予算", relevance: "primary", digest: "予算審議の要点", speakers: ["議員 A"] },
      ],
      summaryModel: "gemini-2.5-flash",
      summaryGeneratedAt: "2026-04-19T10:00:00.000Z",
    });

    const content = await readFile(join(dataDir, "2024", "462012", "summaries.ndjson"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.meetingId).toBe("m-1");
    expect(parsed.summary).toBe("本会議のサマリ");
    expect(parsed.topicDigests).toEqual([
      { topic: "予算", relevance: "primary", digest: "予算審議の要点", speakers: ["議員 A"] },
    ]);
    expect(parsed.summaryModel).toBe("gemini-2.5-flash");
  });

  it("複数回呼んでも append されて行が積み上がる", async () => {
    await appendSummaryRow(dataDir, {
      meetingId: "m-1",
      municipalityCode: "462012",
      heldOn: "2024-03-15",
      summary: "1 回目",
      topicDigests: [],
      summaryModel: "gemini-2.5-flash",
      summaryGeneratedAt: "2026-04-19T10:00:00.000Z",
    });
    await appendSummaryRow(dataDir, {
      meetingId: "m-1",
      municipalityCode: "462012",
      heldOn: "2024-03-15",
      summary: "2 回目",
      topicDigests: [],
      summaryModel: "gemini-2.5-pro",
      summaryGeneratedAt: "2026-04-19T11:00:00.000Z",
    });

    const content = await readFile(join(dataDir, "2024", "462012", "summaries.ndjson"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).summary).toBe("1 回目");
    expect(JSON.parse(lines[1]!).summary).toBe("2 回目");
  });

  it("並列で大量に append しても行が壊れず全部入る", async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      meetingId: `m-${i}`,
      municipalityCode: "462012",
      heldOn: "2024-03-15",
      summary: `summary ${i}`.repeat(20),
      topicDigests: [],
      summaryModel: "gemini-2.5-flash",
      summaryGeneratedAt: "2026-04-19T10:00:00.000Z",
    }));

    await Promise.all(rows.map((r) => appendSummaryRow(dataDir, r)));

    const content = await readFile(join(dataDir, "2024", "462012", "summaries.ndjson"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(50);
    const ids = new Set(lines.map((l) => JSON.parse(l).meetingId));
    expect(ids.size).toBe(50);
  });

  it("heldOn が 4 桁年で始まらない場合はエラー", async () => {
    await expect(
      appendSummaryRow(dataDir, {
        meetingId: "m-bad",
        municipalityCode: "462012",
        heldOn: "invalid-date",
        summary: "x",
        topicDigests: [],
        summaryModel: "gemini-2.5-flash",
        summaryGeneratedAt: "2026-04-19T10:00:00.000Z",
      }),
    ).rejects.toThrow(/invalid heldOn/);
  });
});
