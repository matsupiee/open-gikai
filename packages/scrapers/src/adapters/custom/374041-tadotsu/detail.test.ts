import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（山田太郎君）　ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（多度津　一郎君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("多度津一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（田中花子君）　質問いたします。"
    );
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（佐藤次郎君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務部長（高橋三郎君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（鈴木四郎君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("鈴木四郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○企画課長（渡辺五郎君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("渡辺五郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（多度津　一郎君）　答弁します。"
    );
    expect(result.speakerName).toBe("多度津一郎");
  });

  it("カッコなしパターンを解析する", () => {
    const result = parseSpeaker(
      "○議長　ただいまから会議を開きます。"
    );
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("〇（U+3007）マーカーのパターンを解析する", () => {
    const result = parseSpeaker(
      "\u3007教育長（山田君）お答えいたします。"
    );
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
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
○議長（山田太郎君）　ただいまから本日の会議を開きます。
○３番（田中花子君）　質問があります。
○町長（多度津一郎君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("多度津一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山田太郎君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山田太郎君）　ただいま。
○３番（田中花子君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（山田太郎君）　ただいまから会議を開きます。
（３番　田中花子君登壇）
○３番（田中花子君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("〇（U+3007）マーカーも正しく分割する", () => {
    const text = `○議長（山田君）ただいまから会議を開きます。
\u3007教育長（鈴木君）お答えいたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerName).toBe("山田");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");

    expect(statements[1]!.speakerName).toBe("鈴木");
    expect(statements[1]!.speakerRole).toBe("教育長");
    expect(statements[1]!.kind).toBe("answer");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
