import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker("○議長（山川知一郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山川知一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副議長パターンを抽出する", () => {
    const result = parseSpeaker("○副議長（田中太郎君）　休憩いたします。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("休憩いたします。");
  });

  it("市長パターンを抽出する", () => {
    const result = parseSpeaker("○市長（佐々木康男君）　お答えいたします。");
    expect(result.speakerName).toBe("佐々木康男");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○５番（吉田太郎君）　質問いたします。");
    expect(result.speakerName).toBe("吉田太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育部長パターンから部長を抽出する", () => {
    const result = parseSpeaker("○教育部長（佐藤次郎君）　お答えいたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前に全角スペースがある場合に除去する", () => {
    const result = parseSpeaker("○市長（佐々木　康男君）　お答えします。");
    expect(result.speakerName).toBe("佐々木康男");
    expect(result.speakerRole).toBe("市長");
  });

  it("マーカーなしの場合はそのまま content を返す", () => {
    const result = parseSpeaker("ただの文章です。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("ただの文章です。");
  });

  it("◯(白丸)マーカーも対応する", () => {
    const result = parseSpeaker("◯議長（山川知一郎君）　開会します。");
    expect(result.speakerName).toBe("山川知一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("開会します。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
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
      "○議長（山川知一郎君）　ただいまから会議を開きます。",
      "○５番（吉田太郎君）　質問いたします。",
      "○市長（佐々木康男君）　お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("山川知一郎");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("ただいまから会議を開きます。").digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("吉田太郎");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("佐々木康男");
    expect(result[2]!.speakerRole).toBe("市長");
  });

  it("ト書き（登壇等）をスキップする", () => {
    const text = [
      "○議長（山川知一郎君）　開会します。",
      "○（吉田太郎君登壇）",
      "○５番（吉田太郎君）　質問します。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[1]!.speakerRole).toBe("議員");
  });

  it("○マーカーがないテキストは空配列を返す", () => {
    const result = parseStatements("普通のテキストです。マーカーはありません。");
    expect(result).toEqual([]);
  });

  it("startOffset / endOffset が正しく計算される", () => {
    const text = "○議長（山川知一郎君）　開会します。\n○市長（佐々木康男君）　お答えします。";
    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe("開会します。".length + 1);
  });

  it("空の content の発言はスキップする", () => {
    const text = "○議長（山川知一郎君）\n○市長（佐々木康男君）　お答えします。";
    const result = parseStatements(text);

    // 議長の発言は content が空なのでスキップされ、市長のみ
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("市長");
  });
});
