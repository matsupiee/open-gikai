import { describe, expect, it } from "vitest";
import { classifyKind, parseHeldOn, parseSpeaker, parseStatements } from "./detail";

describe("parseHeldOn", () => {
  it("令和の日付を抽出する", () => {
    expect(parseHeldOn("令和７年１２月１０日 (水曜日)")).toBe("2025-12-10");
  });

  it("令和元年に対応する", () => {
    expect(parseHeldOn("令和元年９月３０日（月曜日）")).toBe("2019-09-30");
  });

  it("平成に対応する", () => {
    expect(parseHeldOn("平成３１年３月３１日")).toBe("2019-03-31");
  });
});

describe("parseSpeaker", () => {
  it("議長 + 氏名君パターンを解析する", () => {
    const result = parseSpeaker("○議長 辻本 一夫君 全員起立、礼、着席願います。");
    expect(result.speakerName).toBe("辻本一夫");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("全員起立、礼、着席願います。");
  });

  it("町長 + 氏名君パターンを解析する", () => {
    const result = parseSpeaker("○町長 貝掛 俊之君 皆様おはようございます。");
    expect(result.speakerName).toBe("貝掛俊之");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆様おはようございます。");
  });

  it("議員 + 番号 + 氏名君パターンを解析する", () => {
    const result = parseSpeaker("○議員 ８番 松岡 泉君 皆さん、おはようございます。");
    expect(result.speakerName).toBe("松岡泉");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("番号付き括弧パターンを解析する", () => {
    const result = parseSpeaker("○８番（松岡泉君） 質問いたします。");
    expect(result.speakerName).toBe("松岡泉");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("○総務課長 佐竹 功君 まず、降水量についてお答えいたします。");
    expect(result.speakerName).toBe("佐竹功");
    expect(result.speakerRole).toBe("課長");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
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
  it("○ マーカーで発言を分割する", () => {
    const text = `
○議長 辻本 一夫君 全員起立、礼、着席願います。
○議員 ８番 松岡 泉君 皆さん、おはようございます。
○町長 貝掛 俊之君 皆様おはようございます。
`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("contentHash を付与する", () => {
    const statements = parseStatements("○議長 辻本 一夫君 ただいまより開会します。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset を計算する", () => {
    const text = `○議長 辻本 一夫君 ただいま。
○町長 貝掛 俊之君 お答えします。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });
});
