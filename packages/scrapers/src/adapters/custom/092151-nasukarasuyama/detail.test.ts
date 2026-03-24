import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（中山五男）　おはようございます。"
    );
    expect(result.speakerName).toBe("中山五男");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("おはようございます。");
  });

  it("市長（名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○市長（川俣純子）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("川俣純子");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副市長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副市長（熊倉精介）　お答えいたします。"
    );
    expect(result.speakerName).toBe("熊倉精介");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（内藤雅伸）　お答えいたします。"
    );
    expect(result.speakerName).toBe("内藤雅伸");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("全角番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１２番（渋井由放）　質問します。"
    );
    expect(result.speakerName).toBe("渋井由放");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("半角番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○3番（田中一郎）　発言します。"
    );
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("発言します。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総合政策課長（小原沢一幸）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("小原沢一幸");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副委員長（山田太郎）　議事を進めます。"
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("議事を進めます。");
  });

  it("名前に全角スペースを含む場合は除去される", () => {
    const result = parseSpeaker(
      "○市長（川　俣　純　子）　ご挨拶します。"
    );
    expect(result.speakerName).toBe("川俣純子");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分開会");
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("総合政策課長（課長で終わる役職）は answer", () => {
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
○議長（中山五男）　ただいまから本日の会議を開きます。
○１２番（渋井由放）　質問があります。
○市長（川俣純子）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("中山五男");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("渋井由放");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("川俣純子");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（中山五男）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（中山五男）　ただいま。
○１番（田中一郎）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（中山五男）　ただいまから会議を開きます。
○（１２番　渋井由放君登壇）
○１２番（渋井由放）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○マーカーなしのテキストブロックはスキップする", () => {
    const text = `令和７年第５回１２月定例会
○議長（中山五男）　発言します。
出席議員一覧`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("副市長の発言は answer に分類される", () => {
    const statements = parseStatements(
      "○副市長（熊倉精介）　ご説明いたします。"
    );
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("副市長");
  });
});
