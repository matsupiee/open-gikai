import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（括弧付き）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（田中太郎君）　ただいまから本日の会議を開きます。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（括弧付き）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（山田次郎君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("山田次郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号＋括弧付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○3番（佐藤花子君）　質問します。",
    );
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("全角番号の議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１２番（鈴木一郎君）　質問があります。",
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問があります。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（高橋三郎君）　御説明いたします。",
    );
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("御説明いたします。");
  });

  it("課長（括弧付き）パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（伊藤四郎君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前＋役職パターン（括弧なし）を解析する", () => {
    const result = parseSpeaker(
      "○田中太郎議長　ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker(
      "○事務局長（渡辺五郎君）　お名前をお呼びいたします。",
    );
    expect(result.speakerName).toBe("渡辺五郎");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("お名前をお呼びいたします。");
  });

  it("マーカーなしの場合は content のみ", () => {
    const result = parseSpeaker("議事日程第１号が配布されております。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("議事日程第１号が配布されております。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○委員長（木村六郎君）　委員会を開会します。",
    );
    expect(result.speakerName).toBe("木村六郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("委員会を開会します。");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（田中太郎君）　ただいまから本日の会議を開きます。
○3番（佐藤花子君）　質問があります。
○町長（山田次郎君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田中太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐藤花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("山田次郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（田中太郎君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const statements = parseStatements(
      "○議長（田中太郎君）　開会。\n○町長（山田次郎君）　答弁。",
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
