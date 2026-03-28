import { describe, expect, it, vi } from "vitest";

vi.mock("../../../utils/pdf", () => ({
  extractText: vi.fn(),
  getDocumentProxy: vi.fn(),
}));

import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを解析する", () => {
    const result = parseSpeaker("○議長（緑川栄一君） 改めまして、おはようございます。");
    expect(result.speakerName).toBe("緑川栄一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("改めまして、おはようございます。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker("○４番（野崎喜彦君） 改めまして、おはようございます。");
    expect(result.speakerName).toBe("野崎喜彦");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("改めまして、おはようございます。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("○産業振興課長（佐川文夫君） お答えいたします。");
    expect(result.speakerName).toBe("佐川文夫");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("先頭の登壇ト書きを本文から除去する", () => {
    const result = parseSpeaker(
      "○町長（岡部光徳君） 〔町長 岡部光徳君登壇〕 お答えいたします。",
    );
    expect(result.speakerName).toBe("岡部光徳");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
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
  it("見出しとト書きを避けつつ発言ブロックを抽出する", () => {
    const text = `
      ◎開議の宣告
      ○議長（緑川栄一君） 改めまして、おはようございます。 本日の会議を開きます。
      ◎一般質問
      ○議長（緑川栄一君） ４番、野崎喜彦君。 〔４番 野崎喜彦君登壇〕
      ○４番（野崎喜彦君） 改めまして、おはようございます。 それでは、早速質問に入らせていただきます。
      ○議長（緑川栄一君） 町長、岡部光徳君。 〔町長 岡部光徳君登壇〕
      ○町長（岡部光徳君） ４番、野崎喜彦議員の第１問にお答えいたします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(5);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe(
      "改めまして、おはようございます。 本日の会議を開きます。",
    );
    expect(statements[1]!.speakerRole).toBe("議長");
    expect(statements[1]!.content).toBe("４番、野崎喜彦君。");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[3]!.speakerRole).toBe("議長");
    expect(statements[3]!.content).toBe("町長、岡部光徳君。");
    expect(statements[4]!.speakerRole).toBe("町長");
  });

  it("contentHash と offset を付与する", () => {
    const statements = parseStatements(
      "○議長（緑川栄一君） 開議します。 ○町長（岡部光徳君） お答えします。",
    );

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開議します。".length);
    expect(statements[1]!.startOffset).toBe("開議します。".length + 1);
  });
});
