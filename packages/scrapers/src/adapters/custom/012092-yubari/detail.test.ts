import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker("○議長（田中太郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("市長パターンを抽出する", () => {
    const result = parseSpeaker("○市長（鈴木一郎君）　お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○３番（山田花子君）　質問いたします。");
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker("○総務課長（佐藤次郎君）　お答えいたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副議長パターンを抽出する", () => {
    const result = parseSpeaker("○副議長（高橋次郎君）　議事を進めます。");
    expect(result.speakerName).toBe("高橋次郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("議事を進めます。");
  });

  it("副市長パターンを抽出する", () => {
    const result = parseSpeaker("○副市長（山本三郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("山本三郎");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長パターンを抽出する", () => {
    const result = parseSpeaker("○教育長（伊藤四郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長パターンを抽出する", () => {
    const result = parseSpeaker("○副委員長（田中花子君）　採決を行います。");
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("採決を行います。");
  });

  it("名前にスペースが含まれる場合スペースを除去する", () => {
    const result = parseSpeaker("○市長（鈴木　一郎君）　お答えします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("市長");
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

  it("市長は answer に分類する", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer に分類する", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("課長は answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育長は answer に分類する", () => {
    expect(classifyKind("教育長")).toBe("answer");
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
      "○議長（田中太郎君）　ただいまから会議を開きます。",
      "○３番（山田花子君）　質問いたします。",
      "○市長（鈴木一郎君）　お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("田中太郎");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("ただいまから会議を開きます。").digest("hex")
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("山田花子");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("鈴木一郎");
    expect(result[2]!.speakerRole).toBe("市長");
  });

  it("ト書き（登壇等）をスキップする", () => {
    const text = [
      "○議長（田中太郎君）　質問を許します。",
      "○（山田花子君登壇）",
      "○３番（山田花子君）　質問いたします。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[1]!.speakerRole).toBe("議員");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○マーカーがないテキストでは空配列を返す", () => {
    expect(parseStatements("ただの説明テキストです。")).toEqual([]);
  });

  it("startOffset / endOffset が連続している", () => {
    const text = [
      "○議長（田中太郎君）　開会します。",
      "○市長（鈴木一郎君）　答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（田中太郎君）　ただいまから会議を開きます。";
    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
