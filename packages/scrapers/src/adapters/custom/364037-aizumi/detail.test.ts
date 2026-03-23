import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker("○議長（岡田博義君）　それでは、ただいまから会議を開きます。");
    expect(result.speakerName).toBe("岡田博義");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("副議長パターンを抽出する", () => {
    const result = parseSpeaker("○副議長（山田太郎君）　休憩します。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("休憩します。");
  });

  it("町長パターンを抽出する", () => {
    const result = parseSpeaker("○町長（茂里英治君）　お答えいたします。");
    expect(result.speakerName).toBe("茂里英治");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○３番（佐藤一郎君）　質問いたします。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker("○総務課長（田中次郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("名前の中の全角スペースを除去する", () => {
    const result = parseSpeaker("○町長（茂里　英治君）　お答えいたします。");
    expect(result.speakerName).toBe("茂里英治");
    expect(result.speakerRole).toBe("町長");
  });

  it("教育長パターンを抽出する", () => {
    const result = parseSpeaker("○教育長（松本太郎君）　お答えいたします。");
    expect(result.speakerName).toBe("松本太郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("部長パターンを抽出する", () => {
    const result = parseSpeaker("○総務部長（鈴木花子君）　ご説明申し上げます。");
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("マーカーなしの場合はコンテンツのみ返す", () => {
    const result = parseSpeaker("ただいまから会議を開きます。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("ただいまから会議を開きます。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで区切られた発言を分割する", () => {
    const text = [
      "○議長（岡田博義君）　ただいまから会議を開きます。",
      "○３番（佐藤一郎君）　質問いたします。藍住町の今後の方針について伺います。",
      "○町長（茂里英治君）　お答えいたします。町の発展のために努力いたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("岡田博義");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("ただいまから会議を開きます。").digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("佐藤一郎");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("茂里英治");
    expect(result[2]!.speakerRole).toBe("町長");
  });

  it("○マーカーのないテキストは無視する", () => {
    const text = "これはヘッダーテキストです\n○議長（岡田博義君）　開会します。";

    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("ト書き（登壇等）をスキップする", () => {
    const text = [
      "○議長（岡田博義君）　開会します。",
      "○（佐藤一郎議員登壇）",
      "○３番（佐藤一郎君）　質問します。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[1]!.speakerRole).toBe("議員");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("startOffset / endOffset が連続する", () => {
    const text = [
      "○議長（岡田博義君）　開会します。",
      "○町長（茂里英治君）　お答えします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });
});
