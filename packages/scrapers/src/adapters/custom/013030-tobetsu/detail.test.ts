import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○議長（山本太郎）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("山本太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○町長（田中一郎）　お答えいたします。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○副町長（佐々木喜代孝）　御説明申し上げます。");
    expect(result.speakerName).toBe("佐々木喜代孝");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("御説明申し上げます。");
  });

  it("教育長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○教育長（鈴木三郎）　お答えいたします。");
    expect(result.speakerName).toBe("鈴木三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員（半角）パターンを解析する", () => {
    const result = parseSpeaker("○5番（佐藤次郎）　質問いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号議員（全角）パターンを解析する", () => {
    const result = parseSpeaker("○５番（田中太郎）　発言します。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("発言します。");
  });

  it("議会運営委員長パターンを解析する", () => {
    const result = parseSpeaker("○議会運営委員長（高橋五郎）　ただいまから委員会を開会します。");
    expect(result.speakerName).toBe("高橋五郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ただいまから委員会を開会します。");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分開議");
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

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（山本太郎）　ただいまから本日の会議を開きます。
○5番（佐藤次郎）　質問があります。
○町長（田中一郎）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山本太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐藤次郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("田中一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山本太郎）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山本太郎）　ただいま。
○5番（佐藤次郎）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（山本太郎）　ただいまから会議を開きます。
○（5番　佐藤次郎君登壇）
○5番（佐藤次郎）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("◎ で始まる議事日程見出しはスキップする", () => {
    const text = `◎日程第1　会議録署名議員指名
○議長（山本太郎）　日程第1を議題といたします。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
