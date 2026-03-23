import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker("○議長（堀川洋一君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("堀川洋一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("市長パターンを抽出する", () => {
    const result = parseSpeaker("○市長（望月良男君）　お答えいたします。");
    expect(result.speakerName).toBe("望月良男");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○３番（山田太郎君）　質問いたします。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育部長パターンを抽出する", () => {
    const result = parseSpeaker("○教育部長（佐藤次郎君）　お答えいたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副議長パターンを抽出する", () => {
    const result = parseSpeaker("○副議長（田中一郎君）　議長に代わり進行いたします。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("議長に代わり進行いたします。");
  });

  it("名前の全角スペースを除去する", () => {
    const result = parseSpeaker("○市長（望月　良男君）　お答えします。");
    expect(result.speakerName).toBe("望月良男");
    expect(result.speakerRole).toBe("市長");
  });

  it("マーカーなしの場合は content のみ返す", () => {
    const result = parseSpeaker("ただのテキスト");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("ただのテキスト");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker("○総務課長（鈴木一郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで分割して ParsedStatement 配列を生成する", () => {
    const text = [
      "○議長（堀川洋一君）　ただいまから本日の会議を開きます。",
      "○３番（山田太郎君）　質問いたします。",
      "○市長（望月良男君）　お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("堀川洋一");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから本日の会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("ただいまから本日の会議を開きます。").digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("山田太郎");
    expect(result[1]!.speakerRole).toBe("議員");
    expect(result[1]!.content).toBe("質問いたします。");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("望月良男");
    expect(result[2]!.speakerRole).toBe("市長");
    expect(result[2]!.content).toBe("お答えいたします。");
  });

  it("ト書き（登壇等）をスキップする", () => {
    const text = [
      "○議長（堀川洋一君）　発言を許可します。",
      "○（山田太郎君登壇）",
      "○３番（山田太郎君）　質問いたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[1]!.speakerRole).toBe("議員");
  });

  it("○マーカーがないテキストブロックは無視する", () => {
    const text = [
      "ここは前文です。",
      "○議長（堀川洋一君）　開会します。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("startOffset と endOffset が正しく計算される", () => {
    const text = [
      "○議長（堀川洋一君）　開会します。",
      "○市長（望月良男君）　お答えします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe("開会します。".length + 1);
  });
});
