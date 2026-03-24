import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○議長（山口政明君） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("山口政明");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長パターンを抽出する", () => {
    const result = parseSpeaker("○町長（宮本道治君） お答えいたします。");
    expect(result.speakerName).toBe("宮本道治");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを抽出する", () => {
    const result = parseSpeaker("○副町長（田中一郎君） ご答弁申し上げます。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご答弁申し上げます。");
  });

  it("教育長パターンを抽出する", () => {
    const result = parseSpeaker("○教育長（佐藤花子君） お答えいたします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターン（全角）を抽出する", () => {
    const result = parseSpeaker("○１番（山下義広君） 質問いたします。");
    expect(result.speakerName).toBe("山下義広");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号付き議員パターン（半角）を抽出する", () => {
    const result = parseSpeaker("○3番（中村次郎君） 質問いたします。");
    expect(result.speakerName).toBe("中村次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターン（部局名付き）を抽出する", () => {
    const result = parseSpeaker("○総務課課長（田中太郎君） ご報告いたします。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("議会事務局長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○議会事務局長（橋本博明君） ご報告申し上げます。",
    );
    expect(result.speakerName).toBe("橋本博明");
    expect(result.speakerRole).toBe("議会事務局長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("名前にスペースが含まれる場合スペースを除去する", () => {
    const result = parseSpeaker("○議長（山口 政明君） 開会します。");
    expect(result.speakerName).toBe("山口政明");
    expect(result.speakerRole).toBe("議長");
  });

  it("〇 (U+3007) マーカーにも対応する", () => {
    const result = parseSpeaker("〇議長（山口政明君） 開会します。");
    expect(result.speakerName).toBe("山口政明");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("開会します。");
  });

  it("◯ (U+25EF) マーカーにも対応する", () => {
    const result = parseSpeaker("◯議長（山口政明君） 開会します。");
    expect(result.speakerName).toBe("山口政明");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("開会します。");
  });

  it("マーカーのみで内容がない場合は content が空になる", () => {
    const result = parseSpeaker("○");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("");
  });
});

describe("classifyKind", () => {
  it("議長は remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark に分類する", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark に分類する", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark に分類する", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("議会運営委員長は remark に分類する", () => {
    expect(classifyKind("議会運営委員長")).toBe("remark");
  });

  it("町長は answer に分類する", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer に分類する", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer に分類する", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer に分類する", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議会事務局長は answer に分類する", () => {
    expect(classifyKind("議会事務局長")).toBe("answer");
  });

  it("議員は question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark に分類する", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで分割して ParsedStatement 配列を生成する", () => {
    const text = [
      "○議長（山口政明君） ただいまから会議を開きます。",
      "○１番（山下義広君） 質問いたします。",
      "○町長（宮本道治君） お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("山口政明");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから会議を開きます。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("山下義広");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("宮本道治");
    expect(result[2]!.speakerRole).toBe("町長");
  });

  it("議事日程などの見出し項目をスキップする", () => {
    const text = [
      "○議事日程 第1 会議録署名議員の指名",
      "○出席議員（10名）",
      "○欠席議員（なし）",
      "○説明のため出席した者の職氏名",
      "○職務のため出席した者",
      "○本日の会議に付した事件",
      "○議長（山口政明君） ただいまから会議を開きます。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○マーカーがないテキストでは空配列を返す", () => {
    expect(parseStatements("ただの説明テキストです。")).toEqual([]);
  });

  it("startOffset / endOffset が連続している", () => {
    const text = [
      "○議長（山口政明君） 開会します。",
      "○町長（宮本道治君） 答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });
});
