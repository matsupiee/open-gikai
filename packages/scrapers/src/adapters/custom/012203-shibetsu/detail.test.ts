import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（大野幸一君）　それでは、ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("大野幸一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("市長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○市長（牧野勇司君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("牧野勇司");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（田中太郎君）　質問いたします。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（鈴木一郎君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("総務部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務部長（高橋三郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○委員長（佐藤四郎君）　ただいまから委員会を開会いたします。",
    );
    expect(result.speakerName).toBe("佐藤四郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ただいまから委員会を開会いたします。");
  });

  it("副委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副委員長（伊藤五郎君）　暫時休憩します。",
    );
    expect(result.speakerName).toBe("伊藤五郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("暫時休憩します。");
  });

  it("副市長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副市長（渡辺六郎君）　御説明申し上げます。",
    );
    expect(result.speakerName).toBe("渡辺六郎");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("御説明申し上げます。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○市長（牧野　勇司君）　答弁します。",
    );
    expect(result.speakerName).toBe("牧野勇司");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
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

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
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
○議長（大野幸一君）　ただいまから本日の会議を開きます。
○３番（田中太郎君）　質問があります。
○市長（牧野勇司君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("大野幸一");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中太郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("牧野勇司");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（大野幸一君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（大野幸一君）　ただいま。
○３番（田中太郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（大野幸一君）　ただいまから会議を開きます。
○（３番　田中太郎君登壇）
○３番（田中太郎君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
