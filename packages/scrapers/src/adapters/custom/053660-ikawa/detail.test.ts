import { describe, expect, it } from "vitest";
import { classifyKind, parseDateFromPdfText, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("問（議員名）パターンを解析する", () => {
    const result = parseSpeaker("問（八柳議員） 町の財政状況について伺います。");
    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBe("八柳");
    expect(result.content).toBe("町の財政状況について伺います。");
  });

  it("答（町長）パターンを解析する", () => {
    const result = parseSpeaker("答（町長） お答えいたします。");
    expect(result.speakerRole).toBe("町長");
    expect(result.speakerName).toBeNull();
    expect(result.content).toBe("お答えいたします。");
  });

  it("答（総務課長）パターンを解析する", () => {
    const result = parseSpeaker("答（総務課長） ご説明いたします。");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("問（委員会名）パターンを解析する", () => {
    const result = parseSpeaker("問（総務産業常任委員会） 予算の内訳を教えてください。");
    // 総務産業常任委員会 は ROLE_SUFFIXES の「委員会」にマッチする
    expect(result.speakerRole).toBe("委員会");
    expect(result.speakerName).toBe("総務産業常任");
    expect(result.content).toBe("予算の内訳を教えてください。");
  });

  it("○マーカー付き議員名パターンを解析する", () => {
    const result = parseSpeaker("○八柳 喜行 議員 一般質問の要旨です。");
    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBe("八柳 喜行");
    expect(result.content).toBe("一般質問の要旨です。");
  });

  it("○マーカー付き町長パターンを解析する", () => {
    const result = parseSpeaker("○町長（田中次郎君） お答えいたします。");
    expect(result.speakerRole).toBe("町長");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.content).toBe("お答えいたします。");
  });

  it("マーカーも問答もないテキストはそのままコンテンツとして返す", () => {
    const result = parseSpeaker("第2回定例会 会期 6月10日〜13日");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("第2回定例会 会期 6月10日〜13日");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseDateFromPdfText", () => {
  it("会期パターンから開始日を抽出する", () => {
    const text = "第2回定例会 会期 6月10日〜13日";
    expect(parseDateFromPdfText(text, 2025, 6)).toBe("2025-06-10");
  });

  it("全角数字の会期パターンを処理する", () => {
    const text = "第２回定例会　会期　６月１０日〜１３日";
    expect(parseDateFromPdfText(text, 2025, 6)).toBe("2025-06-10");
  });

  it("令和の日付パターンを処理する", () => {
    const text = "令和7年9月2日（火曜日）";
    expect(parseDateFromPdfText(text, 2025, 9)).toBe("2025-09-02");
  });

  it("平成の日付パターンを処理する", () => {
    const text = "平成28年3月14日（月曜日）";
    expect(parseDateFromPdfText(text, 2016, 3)).toBe("2016-03-14");
  });

  it("日付が見つからない場合は月初日を返す", () => {
    expect(parseDateFromPdfText("テキストのみ", 2024, 12)).toBe("2024-12-01");
  });
});

describe("parseStatements", () => {
  it("問答パターンから発言を抽出する", () => {
    const text = `
問（八柳議員） 町の財政状況について伺います。
答（町長） 財政健全化に取り組んでいます。
問（佐々木委員） 詳細を教えてください。
答（総務課長） 詳細はこちらです。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(4);

    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.content).toBe("町の財政状況について伺います。");

    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.content).toBe("財政健全化に取り組んでいます。");

    expect(statements[3]!.kind).toBe("answer");
    expect(statements[3]!.speakerRole).toBe("課長");
  });

  it("○マーカー付きパターンから発言を抽出する", () => {
    const text = `
○八柳 喜行 議員 一般質問の内容です。
○佐々木昌子 議員 質問項目についてです。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerRole).toBe("議員");
  });

  it("マーカーのない行はスキップする", () => {
    const text = `
これは通常の文章です。
問（議員） 発言内容。
また通常の文章。
`;
    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("発言内容。");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "問（議員） テスト発言。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `問（議員） 最初の発言。
答（町長） 次の発言。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("最初の発言。".length);
    expect(statements[1]!.startOffset).toBe("最初の発言。".length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("コンテンツが空の発言はスキップする", () => {
    const text = `
○八柳 喜行 議員
問（議員） 実際の発言内容。
`;
    const statements = parseStatements(text);
    // ○八柳 喜行 議員 はコンテンツが空なのでスキップされる
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("実際の発言内容。");
  });
});
