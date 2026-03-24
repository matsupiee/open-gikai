import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（渡辺英雄君）　ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("渡辺英雄");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（小林俊夫君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("小林俊夫");
    expect(result.speakerRole).toBe("町長");
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

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（鈴木次郎君）　お答えします。",
    );
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("お答えします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（山田花子君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（佐藤一郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○委員長（高橋三郎君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副委員長（伊藤四郎君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（小林　俊夫君）　答弁します。",
    );
    expect(result.speakerName).toBe("小林俊夫");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時開議");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("委員は question", () => {
    expect(classifyKind("委員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（渡辺英雄君）　ただいまから本日の会議を開きます。
○３番（田中太郎君）　質問があります。
○町長（小林俊夫君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("渡辺英雄");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中太郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("小林俊夫");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（渡辺英雄君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（渡辺英雄君）　ただいま。
○３番（田中太郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（渡辺英雄君）　ただいまから会議を開きます。
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
