import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker("議長（杉浦和人君） ただいまの出席議員は全員であります。");
    expect(result.speakerName).toBe("杉浦和人");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまの出席議員は全員であります。");
  });

  it("番号議員パターンを抽出する", () => {
    const result = parseSpeaker("２番（谷口智哉君） 一問一答方式で質問します。");
    expect(result.speakerName).toBe("谷口智哉");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一問一答方式で質問します。");
  });

  it("課長系の答弁者を抽出する", () => {
    const result = parseSpeaker("総務課主席参事（岡本昭彦君） ご質問にお答えします。");
    expect(result.speakerName).toBe("岡本昭彦");
    expect(result.speakerRole).toBe("主席参事");
    expect(result.content).toBe("ご質問にお答えします。");
  });

  it("名前中の空白を除去する", () => {
    const result = parseSpeaker("企画振興課長（小島 勝君） 事業概要を説明します。");
    expect(result.speakerName).toBe("小島勝");
    expect(result.speakerRole).toBe("課長");
  });

  it("パターンに合わない場合はそのまま返す", () => {
    const result = parseSpeaker("ただの文章です。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("ただの文章です。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("主席参事は answer", () => {
    expect(classifyKind("主席参事")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("話者見出しで発言を分割して ParsedStatement 配列を生成する", () => {
    const text = [
      "3-3 会議の概要",
      "議長（杉浦和人君） 皆さん、おはようございます。",
      "２番（谷口智哉君） 一問一答方式で質問します。",
      "町長（堀江和博君） ご質問にお答えします。",
    ].join(" ");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("杉浦和人");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("皆さん、おはようございます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("皆さん、おはようございます。").digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("谷口智哉");
    expect(result[1]!.speakerRole).toBe("議員");
    expect(result[1]!.content).toBe("一問一答方式で質問します。");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("堀江和博");
    expect(result[2]!.speakerRole).toBe("町長");
  });

  it("課長系の答弁も分割できる", () => {
    const text = [
      "会議の概要",
      "２番（谷口智哉君） 残業時間の状況について伺います。",
      "総務課長（正木博之君） ご質問のとおりでございます。",
    ].join(" ");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[1]!.speakerRole).toBe("課長");
    expect(result[1]!.kind).toBe("answer");
  });

  it("発言が抽出できない場合は空配列を返す", () => {
    expect(parseStatements("会議録本文です。話者見出しはありません。")).toEqual([]);
  });

  it("startOffset と endOffset を連番で計算する", () => {
    const result = parseStatements(
      "会議の概要 議長（杉浦和人君） 開会します。 町長（堀江和博君） お答えします。",
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe("開会します。".length + 1);
  });

  it("contentHash は 64 文字の SHA-256 になる", () => {
    const result = parseStatements(
      "会議の概要 議長（杉浦和人君） ただいまから会議を開きます。",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("content が空のブロックはスキップする", () => {
    const result = parseStatements(
      "会議の概要 議長（杉浦和人君） 町長（堀江和博君） お答えします。",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("町長");
  });
});
