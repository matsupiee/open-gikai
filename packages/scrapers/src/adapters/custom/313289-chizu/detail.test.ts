import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（括弧付き名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（谷口雅人） ただいまより本日の会議を開きます。",
    );
    expect(result.speakerName).toBe("谷口雅人");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまより本日の会議を開きます。");
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeaker("○町長（金兒英夫） お答えいたします。");
    expect(result.speakerName).toBe("金兒英夫");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("○副町長（矢部整） 補足いたします。");
    expect(result.speakerName).toBe("矢部整");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("補足いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（田中靖） ご報告いたします。");
    expect(result.speakerName).toBe("田中靖");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("全角番号の議員パターンを解析する", () => {
    const result = parseSpeaker("○５番（宮本行雄） 質問があります。");
    expect(result.speakerName).toBe("宮本行雄");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問があります。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("○総務課長（國岡厚志） 御説明いたします。");
    expect(result.speakerName).toBe("國岡厚志");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("御説明いたします。");
  });

  it("名前中の空白を除去する", () => {
    const result = parseSpeaker("○議長（谷口　雅人） テスト。");
    expect(result.speakerName).toBe("谷口雅人");
  });

  it("マーカーなしの場合は content のみ", () => {
    const result = parseSpeaker("議事日程第１号が配布されております。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("議事日程第１号が配布されております。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
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

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（谷口雅人） ただいまより本日の会議を開きます。
○５番（宮本行雄） 質問があります。
○町長（金兒英夫） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("谷口雅人");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("宮本行雄");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("金兒英夫");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○議長（谷口雅人） テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const statements = parseStatements(
      "○議長（谷口雅人） 開会。\n○町長（金兒英夫） 答弁。",
    );
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(3);
    expect(statements[1]!.startOffset).toBe(4);
    expect(statements[1]!.endOffset).toBe(7);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○ マーカーがないテキストはスキップする", () => {
    const statements = parseStatements("議事日程が配布されました。");
    expect(statements.length).toBe(0);
  });
});
