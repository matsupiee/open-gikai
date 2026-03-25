import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（黒岩　巧君）　それでは、ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("黒岩巧");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（萩原睦男君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("萩原睦男");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("全角番号の議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１０番（牧山　明君）　質問いたします。",
    );
    expect(result.speakerName).toBe("牧山明");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務文教常任委員長（入澤信夫君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("入澤信夫");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("産業建設常任委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○産業建設常任委員長（牧山　明君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("牧山明");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（梶野寛丈君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("梶野寛丈");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（小林敦子君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("小林敦子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前に全角スペースを含む場合はスペースを除去する", () => {
    const result = parseSpeaker(
      "○議長（黒岩　巧君）　開会します。",
    );
    expect(result.speakerName).toBe("黒岩巧");
  });

  it("○マーカーなしのテキスト", () => {
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
  it("○ マーカーでテキストを発言単位に分割する", () => {
    const text = `
○議長（黒岩　巧君）　ただいまから本日の会議を開きます。
○１０番（牧山　明君）　質問があります。
○町長（萩原睦男君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("黒岩巧");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("牧山明");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("萩原睦男");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（黒岩　巧君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（黒岩　巧君）　ただいま。
○１０番（牧山　明君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（黒岩　巧君）　ただいまから会議を開きます。
〔町長　萩原睦男君　登壇〕
○町長（萩原睦男君）　ご説明いたします。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
