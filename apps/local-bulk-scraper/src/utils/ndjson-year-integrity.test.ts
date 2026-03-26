import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { checkYearNdjsonIntegrity } from "./ndjson-year-integrity";

describe("checkYearNdjsonIntegrity", () => {
  function fixtureDir(): string {
    return mkdtempSync(join(tmpdir(), "og-ndjson-integrity-"));
  }

  it("complete when every meeting has at least one statement", async () => {
    const dir = fixtureDir();
    writeFileSync(
      join(dir, "meetings.ndjson"),
      [
        JSON.stringify({ id: "m1", title: "a" }),
        JSON.stringify({ id: "m2", title: "b" }),
      ].join("\n") + "\n",
    );
    writeFileSync(
      join(dir, "statements.ndjson"),
      [
        JSON.stringify({ id: "s1", meetingId: "m1", kind: "remark", content: "x", contentHash: "h" }),
        JSON.stringify({ id: "s2", meetingId: "m2", kind: "remark", content: "y", contentHash: "h" }),
      ].join("\n") + "\n",
    );

    const r = await checkYearNdjsonIntegrity(dir);
    expect(r.complete).toBe(true);
  });

  it("incomplete when statements.ndjson is missing", async () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, "meetings.ndjson"), JSON.stringify({ id: "m1" }) + "\n");

    const r = await checkYearNdjsonIntegrity(dir);
    expect(r.complete).toBe(false);
    expect(r.reason).toMatch(/statements\.ndjson/);
  });

  it("incomplete when a meeting has no statements", async () => {
    const dir = fixtureDir();
    writeFileSync(
      join(dir, "meetings.ndjson"),
      [JSON.stringify({ id: "m1" }), JSON.stringify({ id: "m2" })].join("\n") + "\n",
    );
    writeFileSync(
      join(dir, "statements.ndjson"),
      JSON.stringify({
        id: "s1",
        meetingId: "m1",
        kind: "remark",
        content: "x",
        contentHash: "h",
      }) + "\n",
    );

    const r = await checkYearNdjsonIntegrity(dir);
    expect(r.complete).toBe(false);
    expect(r.reason).toMatch(/発言0件/);
    expect(r.reason).toContain("m2");
  });

  it("skips blank lines in ndjson files", async () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, "meetings.ndjson"), "\n" + JSON.stringify({ id: "m1" }) + "\n\n");
    writeFileSync(
      join(dir, "statements.ndjson"),
      "\n" +
        JSON.stringify({
          id: "s1",
          meetingId: "m1",
          kind: "remark",
          content: "x",
          contentHash: "h",
        }) +
        "\n",
    );

    const r = await checkYearNdjsonIntegrity(dir);
    expect(r.complete).toBe(true);
  });
});
