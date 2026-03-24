import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractHeldOn, parseStatements } from "./detail";

describe("extractHeldOn", () => {
  it("単日の開催日を変換する", () => {
    expect(extractHeldOn("1月27日", 2026)).toBe("2026-01-27");
  });

  it("範囲指定の場合は開始日を返す", () => {
    expect(extractHeldOn("2月14日～2月22日", 2026)).toBe("2026-02-14");
  });

  it("全角数字の日付を変換する", () => {
    expect(extractHeldOn("１月２７日", 2026)).toBe("2026-01-27");
  });

  it("月・日が1桁の場合も0埋めする", () => {
    expect(extractHeldOn("9月9日", 2019)).toBe("2019-09-09");
  });

  it("12月の日付を変換する", () => {
    expect(extractHeldOn("12月9日～12月12日", 2025)).toBe("2025-12-09");
  });

  it("パターンに合致しない場合は null を返す", () => {
    expect(extractHeldOn("不明", 2024)).toBeNull();
    expect(extractHeldOn("", 2024)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("PDF テキストの各行を remark として返す", () => {
    const text = [
      "丸森町議会臨時会議決結果",
      "令和8年1月27日",
      "議案第1号　令和7年度丸森町一般会計補正予算（第8号）　原案可決",
      "議案第2号　丸森町固定資産評価審査委員会委員の選任について　原案可決",
    ].join("\n");

    const result = parseStatements(text);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBeNull();
    expect(result[0]!.speakerRole).toBeNull();
    expect(result[0]!.content).toBe("丸森町議会臨時会議決結果");
  });

  it("空行をスキップする", () => {
    const text = [
      "丸森町議会議決結果",
      "",
      "  ",
      "議案第1号　原案可決",
    ].join("\n");

    const result = parseStatements(text);
    expect(result.every((s) => s.content.trim().length > 0)).toBe(true);
  });

  it("ページ番号のみの行をスキップする", () => {
    const text = [
      "丸森町議会議決結果",
      "1",
      "2",
      "議案第1号　原案可決",
    ].join("\n");

    const result = parseStatements(text);
    expect(result.every((s) => !/^\d+$/.test(s.content))).toBe(true);
  });

  it("5文字未満の行をスキップする", () => {
    const text = [
      "丸森町議会議決結果",
      "可決",
      "議案第1号　原案可決",
    ].join("\n");

    const result = parseStatements(text);
    expect(result.every((s) => s.content.length >= 5)).toBe(true);
  });

  it("contentHash が生成される", () => {
    const text = "議案第1号　令和7年度丸森町一般会計補正予算（第8号）　原案可決";
    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update(text.trim()).digest("hex"),
    );
  });

  it("startOffset と endOffset が連続する", () => {
    const lines = [
      "丸森町議会臨時会議決結果",
      "議案第1号　原案可決　",
    ];
    const text = lines.join("\n");

    const result = parseStatements(text);

    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("丸森町議会臨時会議決結果".length);
    expect(result[1]!.startOffset).toBe("丸森町議会臨時会議決結果".length + 1);
  });

  it("テキストが空の場合は空配列を返す", () => {
    expect(parseStatements("")).toHaveLength(0);
  });
});
