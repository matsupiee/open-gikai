import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseStatements } from "./detail";

describe("parseStatements", () => {
  it("PDF テキストの各行を remark として返す", () => {
    const text = [
      "令和７年第３回藤里町議会定例会",
      "【 会期：９月１０日（水）～９月１９日（金）１０日間 】",
      "議案第61号 職員の育児休業等に関する条例の一部を改正する条例の制定について 原案可決",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBeNull();
    expect(result[0]!.speakerRole).toBeNull();
    expect(result[0]!.content).toBe("令和７年第３回藤里町議会定例会");
  });

  it("空行とページ番号のみの行をスキップする", () => {
    const text = [
      "令和７年第３回藤里町議会定例会",
      "",
      "1",
      "議案第61号 原案可決",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result.every((statement) => statement.content !== "1")).toBe(true);
  });

  it("短すぎる行をスキップする", () => {
    const text = ["議", "案", "議案第61号 原案可決"].join("\n");
    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe("議案第61号 原案可決");
  });

  it("1行に潰れた PDF テキストも議案番号ごとに分割する", () => {
    const text = [
      "令和７年第４回藤里町議会定例会 【 会期：１２月９日（火）～１２月１２日（金）４日間 】",
      "議 案 第７３号 条例の制定について 原案可決",
      "議 案 第７４号 条例の一部改正について 原案可決",
    ].join(" ");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.content).toContain("令和７年第４回藤里町議会定例会");
    expect(result[1]!.content).toContain("議 案 第７３号");
    expect(result[2]!.content).toContain("議 案 第７４号");
  });

  it("contentHash を生成する", () => {
    const text = "議案第61号 原案可決";
    const result = parseStatements(text);

    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update(text).digest("hex"),
    );
  });

  it("offset が連続する", () => {
    const first = "令和７年第３回藤里町議会定例会";
    const second = "議案第61号 原案可決";

    const result = parseStatements([first, second].join("\n"));

    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe(first.length);
    expect(result[1]!.startOffset).toBe(first.length + 1);
  });
});
