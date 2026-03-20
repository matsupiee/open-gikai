import { describe, expect, test } from "vitest";
import { deduplicateByContentHash } from "./build-chunks";

describe("deduplicateByContentHash", () => {
  test("重複なしの場合はそのまま返す", () => {
    const rows = [
      { contentHash: "aaa", _statementIds: ["s1"], other: "x" },
      { contentHash: "bbb", _statementIds: ["s2"], other: "y" },
    ];
    const result = deduplicateByContentHash(rows);
    expect(result).toHaveLength(2);
    expect(result[0]!._statementIds).toEqual(["s1"]);
    expect(result[1]!._statementIds).toEqual(["s2"]);
  });

  test("同一contentHashの行はstatementIdsが統合される", () => {
    const rows = [
      { contentHash: "aaa", _statementIds: ["s1"] },
      { contentHash: "bbb", _statementIds: ["s2"] },
      { contentHash: "aaa", _statementIds: ["s3"] },
    ];
    const result = deduplicateByContentHash(rows);
    expect(result).toHaveLength(2);
    expect(result[0]!.contentHash).toBe("aaa");
    expect(result[0]!._statementIds).toEqual(["s1", "s3"]);
    expect(result[1]!.contentHash).toBe("bbb");
    expect(result[1]!._statementIds).toEqual(["s2"]);
  });

  test("3つ以上の重複も統合される", () => {
    const rows = [
      { contentHash: "aaa", _statementIds: ["s1"] },
      { contentHash: "aaa", _statementIds: ["s2"] },
      { contentHash: "aaa", _statementIds: ["s3"] },
    ];
    const result = deduplicateByContentHash(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!._statementIds).toEqual(["s1", "s2", "s3"]);
  });

  test("空配列の場合は空配列を返す", () => {
    expect(deduplicateByContentHash([])).toEqual([]);
  });
});
