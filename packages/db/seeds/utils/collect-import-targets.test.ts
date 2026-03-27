import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectImportTargets } from "./collect-import-targets";

describe("collectImportTargets", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "collect-targets-test-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  test("存在しないディレクトリは空配列を返す", () => {
    expect(collectImportTargets(join(dataDir, "nonexistent"))).toEqual([]);
  });

  test("_complete がないディレクトリはスキップする", () => {
    const codeDir = join(dataDir, "2024", "011002");
    mkdirSync(codeDir, { recursive: true });
    writeFileSync(join(codeDir, "meetings.ndjson"), "{}");

    expect(collectImportTargets(dataDir)).toEqual([]);
  });

  test("_complete があり imported 未設定のディレクトリを収集する", () => {
    const codeDir = join(dataDir, "2024", "011002");
    mkdirSync(codeDir, { recursive: true });
    writeFileSync(join(codeDir, "_complete"), JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z", meetings: 3, statements: 10 }));
    writeFileSync(join(codeDir, "meetings.ndjson"), "{}");
    writeFileSync(join(codeDir, "statements.ndjson"), "{}");

    const targets = collectImportTargets(dataDir);
    expect(targets).toHaveLength(1);
    expect(targets[0]!.codeDir).toBe(codeDir);
    expect(targets[0]!.meetingsPath).toBe(join(codeDir, "meetings.ndjson"));
    expect(targets[0]!.statementsPath).toBe(join(codeDir, "statements.ndjson"));
  });

  test("imported: true のディレクトリはスキップする", () => {
    const codeDir = join(dataDir, "2024", "011002");
    mkdirSync(codeDir, { recursive: true });
    writeFileSync(join(codeDir, "_complete"), JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z", meetings: 3, imported: true }));
    writeFileSync(join(codeDir, "meetings.ndjson"), "{}");

    expect(collectImportTargets(dataDir)).toEqual([]);
  });

  test("meetings.ndjson がないディレクトリはスキップする", () => {
    const codeDir = join(dataDir, "2024", "011002");
    mkdirSync(codeDir, { recursive: true });
    writeFileSync(join(codeDir, "_complete"), JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z", meetings: 3 }));

    expect(collectImportTargets(dataDir)).toEqual([]);
  });

  test("statements.ndjson がない場合は statementsPath が null になる", () => {
    const codeDir = join(dataDir, "2024", "011002");
    mkdirSync(codeDir, { recursive: true });
    writeFileSync(join(codeDir, "_complete"), JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z", meetings: 3 }));
    writeFileSync(join(codeDir, "meetings.ndjson"), "{}");

    const targets = collectImportTargets(dataDir);
    expect(targets).toHaveLength(1);
    expect(targets[0]!.statementsPath).toBeNull();
  });

  test("年ディレクトリでないものはスキップする", () => {
    const codeDir = join(dataDir, "readme", "011002");
    mkdirSync(codeDir, { recursive: true });
    writeFileSync(join(codeDir, "_complete"), JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z" }));
    writeFileSync(join(codeDir, "meetings.ndjson"), "{}");

    expect(collectImportTargets(dataDir)).toEqual([]);
  });

  test("複数ディレクトリを正しく収集する", () => {
    for (const [year, code] of [["2024", "011002"], ["2024", "012025"], ["2025", "011002"]]) {
      const codeDir = join(dataDir, year!, code!);
      mkdirSync(codeDir, { recursive: true });
      writeFileSync(join(codeDir, "_complete"), JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z", meetings: 1 }));
      writeFileSync(join(codeDir, "meetings.ndjson"), "{}");
    }

    const targets = collectImportTargets(dataDir);
    expect(targets).toHaveLength(3);
  });
});
