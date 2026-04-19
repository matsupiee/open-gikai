import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readStatementsForMeeting } from "./read-statements-ndjson";

describe("readStatementsForMeeting", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "stmts-ndjson-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("heldOn の年ディレクトリから meetingId 一致行のみを startOffset 昇順で返す", async () => {
    const muniDir = join(dataDir, "2024", "462012");
    await mkdir(muniDir, { recursive: true });
    await writeFile(
      join(muniDir, "statements.ndjson"),
      [
        JSON.stringify({
          id: "s1",
          meetingId: "m-target",
          kind: "speech",
          speakerName: "議員 A",
          speakerRole: null,
          content: "発言1",
          contentHash: "h1",
          startOffset: 200,
          endOffset: 250,
        }),
        JSON.stringify({
          id: "s2",
          meetingId: "m-other",
          kind: "speech",
          speakerName: "別会議",
          speakerRole: null,
          content: "無関係",
          contentHash: "h2",
          startOffset: 0,
          endOffset: 10,
        }),
        JSON.stringify({
          id: "s3",
          meetingId: "m-target",
          kind: "question",
          speakerName: "議員 B",
          speakerRole: "議長",
          content: "発言0",
          contentHash: "h3",
          startOffset: 100,
          endOffset: 150,
        }),
      ].join("\n") + "\n",
    );

    const stmts = await readStatementsForMeeting({
      dataDir,
      municipalityCode: "462012",
      heldOn: "2024-03-15",
      meetingId: "m-target",
    });

    expect(stmts.map((s) => s.id)).toEqual(["s3", "s1"]);
    expect(stmts[0]!.content).toBe("発言0");
    expect(stmts[1]!.speakerName).toBe("議員 A");
  });

  it("heldOn の年に無い場合は他の年ディレクトリにフォールバックする", async () => {
    const other = join(dataDir, "2023", "462012");
    await mkdir(other, { recursive: true });
    await writeFile(
      join(other, "statements.ndjson"),
      JSON.stringify({
        id: "s1",
        meetingId: "m-x",
        kind: "speech",
        speakerName: null,
        speakerRole: null,
        content: "古い年度",
        contentHash: "h",
        startOffset: 0,
        endOffset: 5,
      }) + "\n",
    );

    const stmts = await readStatementsForMeeting({
      dataDir,
      municipalityCode: "462012",
      heldOn: "2024-01-01",
      meetingId: "m-x",
    });

    expect(stmts).toHaveLength(1);
    expect(stmts[0]!.content).toBe("古い年度");
  });

  it("NDJSON に該当 meetingId が無いときはエラーを投げる", async () => {
    const muniDir = join(dataDir, "2024", "462012");
    await mkdir(muniDir, { recursive: true });
    await writeFile(join(muniDir, "statements.ndjson"), "");

    await expect(
      readStatementsForMeeting({
        dataDir,
        municipalityCode: "462012",
        heldOn: "2024-03-15",
        meetingId: "missing",
      }),
    ).rejects.toThrow(/statements not found in NDJSON/);
  });
});
