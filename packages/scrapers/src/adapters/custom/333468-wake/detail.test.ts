import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractHeldOnFromText } from "./shared";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("extractHeldOnFromText", () => {
  it("令和の全角日付を変換する", () => {
    expect(extractHeldOnFromText("令和７年１２月４日")).toBe("2025-12-04");
  });

  it("令和の半角日付を変換する", () => {
    expect(extractHeldOnFromText("令和7年12月4日")).toBe("2025-12-04");
  });

  it("令和元年に対応する", () => {
    expect(extractHeldOnFromText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(extractHeldOnFromText("平成30年3月5日")).toBe("2018-03-05");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractHeldOnFromText("2024年3月1日")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長パターンを抽出する（○マーカー）", () => {
    const result = parseSpeaker("○議長（山本太郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山本太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長パターンを抽出する", () => {
    const result = parseSpeaker("○町長（田中一郎君）　お答えいたします。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを抽出する（全角数字）", () => {
    const result = parseSpeaker("○３番（佐藤花子君）　質問いたします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker("○総務課長（鈴木次郎君）　お答えいたします。");
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを抽出する", () => {
    const result = parseSpeaker("○教育長（高橋三郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副町長パターンを抽出する", () => {
    const result = parseSpeaker("○副町長（伊藤四郎君）　お答えします。");
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("お答えします。");
  });

  it("〇マーカー（U+3007）にも対応する", () => {
    const result = parseSpeaker("〇議長（山本太郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山本太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("名前にスペースが含まれる場合スペースを除去する", () => {
    const result = parseSpeaker("○議長（山本　太郎君）　開会します。");
    expect(result.speakerName).toBe("山本太郎");
    expect(result.speakerRole).toBe("議長");
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

  it("課長は answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("総務課長は answer に分類する（endsWith判定）", () => {
    expect(classifyKind("総務課長")).toBe("answer");
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
      "○議長（山本太郎君）　ただいまから会議を開きます。",
      "○３番（佐藤花子君）　質問いたします。",
      "○町長（田中一郎君）　お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("山本太郎");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから会議を開きます。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("佐藤花子");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("田中一郎");
    expect(result[2]!.speakerRole).toBe("町長");
  });

  it("議事日程などの見出し項目をスキップする", () => {
    const text = [
      "○議事日程 １ 会議録署名議員の指名 ２ 会期の決定",
      "○出席議員（12名）",
      "○欠席議員（なし）",
      "○会議録署名議員",
      "○議長（山本太郎君）　ただいまから会議を開きます。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("〇マーカー（U+3007）にも対応する", () => {
    const text = "〇議長（山本太郎君）　ただいまから会議を開きます。";
    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("マーカーがないテキストでは空配列を返す", () => {
    expect(parseStatements("ただの説明テキストです。")).toEqual([]);
  });

  it("startOffset / endOffset が連続している", () => {
    const text = [
      "○議長（山本太郎君）　開会します。",
      "○町長（田中一郎君）　答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（山本太郎君）　ただいまから会議を開きます。";
    const result = parseStatements(text);
    expect(result[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
