import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseHeldOn } from "./detail";
import { normalizePdfText } from "./shared";

describe("normalizePdfText", () => {
  it("CJK 文字間のスペースを除去する（実際の PDF 形式）", () => {
    const input = "○ 議 長 （ 荻 原 謙 一 君 ） こ れ よ り 本 会 議 を 再 開 し ま す 。";
    expect(normalizePdfText(input)).toBe("○議長（荻原謙一君）これより本会議を再開します。");
  });

  it("数字と CJK 文字が混在するテキストを正規化する", () => {
    const input = "令 和 ６ 年 １ ２ 月 ４ 日";
    expect(normalizePdfText(input)).toBe("令和６年１２月４日");
  });

  it("CJK 文字間のスペースは除去されてから parseSpeaker でパースできる", () => {
    const input = "○議長（田中太郎君） ただいまから会議を開きます。";
    // ）と次の CJK 文字の間のスペースも除去される
    expect(normalizePdfText(input)).toBe("○議長（田中太郎君）ただいまから会議を開きます。");
  });
});

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（田中太郎君） ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（鈴木一郎君） お答えいたします。"
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（山田二郎君） ご説明いたします。"
    );
    expect(result.speakerName).toBe("山田二郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（佐藤三郎君） お答えいたします。"
    );
    expect(result.speakerName).toBe("佐藤三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務常任委員長（高橋四郎君） 委員会の報告をいたします。"
    );
    expect(result.speakerName).toBe("高橋四郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("委員会の報告をいたします。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１番（伊藤五郎君） 質問いたします。"
    );
    expect(result.speakerName).toBe("伊藤五郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（渡辺六郎君） ご説明します。"
    );
    expect(result.speakerName).toBe("渡辺六郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明します。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○議長（田中 太郎君） 開会します。"
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分 開会");
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

describe("parseHeldOn", () => {
  it("令和の日付を抽出する", () => {
    const text = "令和6年11月29日\n御代田町議会定例会\n○議長（田中君） 開会します。";
    expect(parseHeldOn(text, 2024)).toBe("2024-11-29");
  });

  it("平成の日付を抽出する", () => {
    const text = "平成25年3月1日\n御代田町議会臨時会\n○議長（鈴木君） 開会します。";
    expect(parseHeldOn(text, 2013)).toBe("2013-03-01");
  });

  it("全角数字の日付を抽出する", () => {
    const text = "令和６年１１月２９日\n御代田町議会定例会";
    expect(parseHeldOn(text, 2024)).toBe("2024-11-29");
  });

  it("日付が見つからない場合はnullを返す", () => {
    expect(parseHeldOn("御代田町議会会議録", 2024)).toBeNull();
    expect(parseHeldOn("", 2024)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（田中太郎君） ただいまから本日の会議を開きます。
○１番（伊藤五郎君） 質問があります。
○町長（鈴木一郎君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田中太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("伊藤五郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（田中太郎君） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中太郎君） ただいま。
○１番（伊藤五郎君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（田中太郎君） ただいまから会議を開きます。
（１番　伊藤五郎君登壇）
○１番（伊藤五郎君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○副町長（山田二郎君） ご説明いたします。
○教育長（佐藤三郎君） お答えいたします。
○総務課長（渡辺六郎君） ご報告します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("副町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("教育長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("課長");
  });
});
