import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（田口琢弥君）　ただいまから開会します。",
    );
    expect(result.speakerName).toBe("田口琢弥");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから開会します。");
  });

  it("市長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○市長（山内　登君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("山内登");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１番（田中秀幸君）　質問いたします。",
    );
    expect(result.speakerName).toBe("田中秀幸");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○3番（山田太郎君）　質問です。",
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問です。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（小坂光泰君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("小坂光泰");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務部長（田口広宣君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("田口広宣");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副市長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副市長（田口公二君）　ご報告します。",
    );
    expect(result.speakerName).toBe("田口公二");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ご報告します。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○福祉課長（佐藤一郎君）　お答えします。",
    );
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○予算決算常任委員会委員長（中島達也君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("中島達也");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長は委員長より優先してマッチする", () => {
    const result = parseSpeaker(
      "○副委員長（鈴木花子君）　報告します。",
    );
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○市長（山内　登君）　答弁します。",
    );
    expect(result.speakerName).toBe("山内登");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前９時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前９時開議");
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
○議長（田口琢弥君）　ただいまから本日の会議を開きます。
○１番（田中秀幸君）　質問があります。
○市長（山内　登君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田口琢弥");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中秀幸");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("山内登");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（田口琢弥君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田口琢弥君）　ただいま。
○１番（田中秀幸君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（田口琢弥君）　ただいまから会議を開きます。
（１番　田中秀幸君登壇）
○１番（田中秀幸君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("◯ (U+25EF) マーカーにも対応する", () => {
    const text = "◯議長（田口琢弥君）　開会します。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });
});
