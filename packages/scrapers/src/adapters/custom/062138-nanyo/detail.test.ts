import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを解析する（名前＋議長）", () => {
    const result = parseSpeaker(
      "○中川裕議長　ただいまより本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("中川裕");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまより本日の会議を開きます。");
  });

  it("市長パターンを解析する", () => {
    const result = parseSpeaker(
      "○白岩孝夫市長　お答えいたします。"
    );
    expect(result.speakerName).toBe("白岩孝夫");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号＋括弧付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（渡部　功議員）　質問します。"
    );
    expect(result.speakerName).toBe("渡部功");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("全角番号の議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１２番（山口大輔議員）　質問があります。"
    );
    expect(result.speakerName).toBe("山口大輔");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問があります。");
  });

  it("部長パターンを解析する（役職（名前）形式）", () => {
    const result = parseSpeaker(
      "○総務部長（山口武芳）　お答えいたします。"
    );
    expect(result.speakerName).toBe("山口武芳");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副市長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副市長（大沼豊広）　御説明いたします。"
    );
    expect(result.speakerName).toBe("大沼豊広");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("御説明いたします。");
  });

  it("事務局長パターンを解析する（名前＋事務局長）", () => {
    const result = parseSpeaker(
      "○小野田博事務局長　ご指名いたします。"
    );
    expect(result.speakerName).toBe("小野田博");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご指名いたします。");
  });

  it("副委員長パターンを解析する（副委員長 > 委員長）", () => {
    const result = parseSpeaker(
      "○鈴木副委員長　これより委員会を開催します。"
    );
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("これより委員会を開催します。");
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

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
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

  it("部長で終わる役職は answer", () => {
    expect(classifyKind("総務部長")).toBe("answer");
  });

  it("課長で終わる役職は answer", () => {
    expect(classifyKind("財政課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○中川裕議長　ただいまより本日の会議を開きます。
○３番（渡部功議員）　質問があります。
○白岩孝夫市長　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("中川裕");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("渡部功");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("白岩孝夫");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○中川裕議長　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const statements = parseStatements(
      "○中川裕議長　開会。\n○白岩孝夫市長　答弁。"
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
