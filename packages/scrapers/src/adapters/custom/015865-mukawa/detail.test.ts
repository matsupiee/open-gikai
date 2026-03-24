import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker("○議長（山田太郎君）　開議を宣告します。");

    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("開議を宣告します。");
  });

  it("町長パターンを抽出する", () => {
    const result = parseSpeaker("○町長（鈴木一郎君）　お答えいたします。");

    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○３番（佐藤花子君）　質問いたします。");

    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○3番（佐藤花子君）　質問いたします。");

    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker("○総務課長（田中二郎君）　お答えいたします。");

    expect(result.speakerName).toBe("田中二郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副議長パターンを抽出する", () => {
    const result = parseSpeaker("○副議長（高橋三郎君）　議事を進めます。");

    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("議事を進めます。");
  });

  it("名前の空白を除去する", () => {
    const result = parseSpeaker("○町長（鈴木　一郎君）　お答えします。");

    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
  });

  it("教育長パターンを抽出する", () => {
    const result = parseSpeaker("○教育長（伊藤四郎君）　お答えいたします。");

    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("カッコパターンに合致しない場合は speakerName/Role が null", () => {
    const result = parseSpeaker("○なにかのテキスト");

    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("なにかのテキスト");
  });
});

describe("classifyKind", () => {
  it("議長を remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長を remark に分類する", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長を remark に分類する", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("町長を answer に分類する", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長を answer に分類する", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長を answer に分類する", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長を answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("部長を answer に分類する", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員を question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null を remark に分類する", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで発言を分割する", () => {
    const text = [
      "○議長（山田太郎君）　開議を宣告します。",
      "○３番（佐藤花子君）　質問いたします。",
      "○町長（鈴木一郎君）　お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("山田太郎");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("開議を宣告します。");

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("佐藤花子");
    expect(result[1]!.speakerRole).toBe("議員");
    expect(result[1]!.content).toBe("質問いたします。");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("鈴木一郎");
    expect(result[2]!.speakerRole).toBe("町長");
    expect(result[2]!.content).toBe("お答えいたします。");
  });

  it("contentHash を SHA-256 で生成する", () => {
    const text = "○議長（山田太郎君）　開議を宣告します。";

    const result = parseStatements(text);

    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("開議を宣告します。").digest("hex"),
    );
  });

  it("ト書き（登壇等）をスキップする", () => {
    const text = [
      "○議長（山田太郎君）　開議を宣告します。",
      "○（佐藤花子議員登壇）",
      "○３番（佐藤花子君）　質問いたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerName).toBe("山田太郎");
    expect(result[1]!.speakerName).toBe("佐藤花子");
  });

  it("startOffset / endOffset を連番で設定する", () => {
    const text = [
      "○議長（山田太郎君）　あいう",
      "○町長（鈴木一郎君）　かきく",
    ].join("\n");

    const result = parseStatements(text);

    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe(3); // "あいう".length
    expect(result[1]!.startOffset).toBe(4); // endOffset + 1
    expect(result[1]!.endOffset).toBe(7); // 4 + "かきく".length
  });

  it("空テキストから空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○マーカーのない文章は無視する", () => {
    const text = "ただの文章です。マーカーがありません。";

    expect(parseStatements(text)).toEqual([]);
  });
});
