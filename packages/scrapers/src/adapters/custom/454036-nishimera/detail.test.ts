import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseDateFromPdfText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("番号（名前君）パターンを処理する", () => {
    const result = parseSpeaker("○1番（田中太郎君）　質問いたします。");
    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.content).toBe("質問いたします。");
  });

  it("役職（名前君）パターンを処理する", () => {
    const result = parseSpeaker("○村長（山田花子君）　お答えします。");
    expect(result.speakerRole).toBe("村長");
    expect(result.speakerName).toBe("山田花子");
    expect(result.content).toBe("お答えします。");
  });

  it("議長パターンを処理する", () => {
    const result = parseSpeaker("○議長（鈴木一郎君）　ただいまから開会します。");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.content).toBe("ただいまから開会します。");
  });

  it("教育長パターンを処理する", () => {
    const result = parseSpeaker("○教育長（佐藤次郎君）　ご説明します。");
    expect(result.speakerRole).toBe("教育長");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.content).toBe("ご説明します。");
  });

  it("{名前}{役職} 形式を処理する", () => {
    const result = parseSpeaker("○総務課長　報告します。");
    expect(result.speakerRole).toBe("課長");
    expect(result.speakerName).toBe("総務");
    expect(result.content).toBe("報告します。");
  });

  it("空のコンテンツは空文字列を返す", () => {
    const result = parseSpeaker("○議長（田中君）");
    expect(result.content).toBe("");
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

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
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

  it("XXX課長は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });
});

describe("parseDateFromPdfText", () => {
  it("令和年月日パターンを処理する", () => {
    const text = "令和6年3月4日開会";
    expect(parseDateFromPdfText(text, 2024)).toBe("2024-03-04");
  });

  it("令和元年パターンを処理する", () => {
    const text = "令和元年6月1日";
    expect(parseDateFromPdfText(text, 2019)).toBe("2019-06-01");
  });

  it("全角数字を処理する", () => {
    const text = "令和６年３月４日";
    expect(parseDateFromPdfText(text, 2024)).toBe("2024-03-04");
  });

  it("N月N日パターンで年を補完する", () => {
    const text = "3月4日開会";
    expect(parseDateFromPdfText(text, 2024)).toBe("2024-03-04");
  });

  it("日付情報がない場合は null を返す", () => {
    expect(parseDateFromPdfText("テキストのみ", 2024)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言を分割する", () => {
    const text = [
      "表紙テキスト",
      "○議長（田中太郎君）　ただいまから開会します。",
      "○1番（鈴木一郎君）　質問いたします。農業について。",
      "○村長（山田花子君）　お答えします。農業振興に取り組みます。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("田中太郎");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.speakerName).toBe("鈴木一郎");
    expect(statements[1]!.content).toContain("農業について");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("村長");
    expect(statements[2]!.speakerName).toBe("山田花子");
    expect(statements[2]!.content).toContain("農業振興に取り組みます");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "○1番（田中君）　テスト発言です。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "○1番（田中君）　最初の発言。",
      "○村長（山田君）　次の発言。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBeGreaterThan(0);
    if (statements.length >= 2) {
      expect(statements[1]!.startOffset).toBeGreaterThan(
        statements[0]!.endOffset,
      );
    }
  });

  it("ト書き（登壇）をスキップする", () => {
    const text = [
      "○1番（田中君登壇）",
      "○1番（田中君）　本日は農業について質問します。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toContain("農業について質問します");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○マーカーのないテキストは空配列を返す", () => {
    expect(parseStatements("これは通常の文章です。")).toEqual([]);
  });
});
