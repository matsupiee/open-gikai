import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isAlreadyImported, markAsImported } from "./complete-marker";

describe("isAlreadyImported", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "complete-marker-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("_complete がないディレクトリは false を返す", () => {
    expect(isAlreadyImported(dir)).toBe(false);
  });

  test("imported フラグがない _complete は false を返す", () => {
    writeFileSync(
      join(dir, "_complete"),
      JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z", meetings: 10, statements: 50 }),
    );
    expect(isAlreadyImported(dir)).toBe(false);
  });

  test("imported: true がある _complete は true を返す", () => {
    writeFileSync(
      join(dir, "_complete"),
      JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z", meetings: 10, statements: 50, imported: true }),
    );
    expect(isAlreadyImported(dir)).toBe(true);
  });

  test("imported: false がある _complete は false を返す", () => {
    writeFileSync(
      join(dir, "_complete"),
      JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z", meetings: 10, imported: false }),
    );
    expect(isAlreadyImported(dir)).toBe(false);
  });

  test("不正な JSON の _complete は false を返す", () => {
    writeFileSync(join(dir, "_complete"), "not json");
    expect(isAlreadyImported(dir)).toBe(false);
  });
});

describe("markAsImported", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "complete-marker-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("既存の _complete に imported と importedAt を追記する", () => {
    writeFileSync(
      join(dir, "_complete"),
      JSON.stringify({ completedAt: "2025-01-01T00:00:00.000Z", meetings: 5, statements: 20 }),
    );

    markAsImported(dir);

    const data = JSON.parse(readFileSync(join(dir, "_complete"), "utf-8"));
    expect(data.imported).toBe(true);
    expect(data.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.completedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(data.meetings).toBe(5);
    expect(data.statements).toBe(20);
  });

  test("_complete がない場合はエラーを投げる", () => {
    expect(() => markAsImported(dir)).toThrow();
  });
});
