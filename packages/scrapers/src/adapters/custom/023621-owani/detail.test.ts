import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, fullyNormalizePdfText } from "./detail";

describe("parseSpeaker", () => {
  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker("○１番（鈴木義則君）　子育て支援について伺う。");
    expect(result.speakerName).toBe("鈴木義則");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("子育て支援について伺う。");
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeaker("○町長（山田太郎君）　お答えいたします。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("○副町長（佐藤次郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（田中三郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("田中三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("課長パターンを解析する（フルネームを含む役職）", () => {
    const result = parseSpeaker("○総務課長（高橋四郎君）　資料のとおりです。");
    expect(result.speakerName).toBe("高橋四郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("資料のとおりです。");
  });

  it("議長パターンを解析する", () => {
    const result = parseSpeaker("○議長（伊藤五郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("伊藤五郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });
});

describe("classifyKind", () => {
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

  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("fullyNormalizePdfText", () => {
  it("CJK 文字間のスペースを除去する", () => {
    const input = "○ 町 長 （ 山 田 太 郎 君 ） お 答 え い た し ま す 。";
    const result = fullyNormalizePdfText(input);
    expect(result).toBe("○町長（山田太郎君）お答えいたします。");
  });

  it("ASCII 間のスペースは保持する", () => {
    const input = "令和 6 年 第 3 回定例会";
    const result = fullyNormalizePdfText(input);
    // CJK間のスペースは除去、ASCII「6」「3」の前後スペースはそのまま
    expect(result).toContain("令和 6 年");
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言を分割する", () => {
    const text =
      "○１番（鈴木義則君）　子育て支援についての具体的な施策を伺う。現状の課題は何か。 ○町長（山田太郎君）　子育て支援については毎年度予算を確保しており、保育所の整備を進めています。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("鈴木義則");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("山田太郎");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const text =
      "○１番（鈴木義則君）　子育て支援についての具体的な施策を伺う。現状の課題は何か。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "○１番（鈴木義則君）　子育て支援についての具体的な施策を伺う。現状の課題は何か。 ○町長（山田太郎君）　子育て支援については予算を確保しており整備を進めています。";

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
  });

  it("ト書き（登壇）をスキップする", () => {
    const text =
      "○（登壇） ○１番（鈴木義則君）　子育て支援についての具体的な施策を伺う。現状の課題は何か。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議員");
  });

  it("複数の質問と回答を分割する", () => {
    const text =
      "○２番（田中花子君）　農業振興について伺う。担い手不足の対策は。 ○副町長（佐藤次郎君）　農業委員会と連携しながら担い手育成を支援しています。 ○２番（田中花子君）　具体的な補助制度の拡充についてはどうか。 ○町長（山田太郎君）　予算の範囲内で補助制度の拡充を検討してまいります。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(4);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[2]!.kind).toBe("question");
    expect(statements[3]!.kind).toBe("answer");
  });

  it("短すぎるコンテンツはスキップする", () => {
    const text =
      "○１番（鈴木義則君）　短 ○町長（山田太郎君）　子育て支援については予算を確保しており整備を進めています。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("町長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○ マーカーがないテキストは空配列を返す", () => {
    expect(parseStatements("会議を開きます")).toEqual([]);
  });
});
