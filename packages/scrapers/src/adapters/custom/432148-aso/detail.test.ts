import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（北里秀和君）　ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("北里秀和");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("市長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○市長（佐藤義興君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("佐藤義興");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（髙宮辰郎君）　質問いたします。"
    );
    expect(result.speakerName).toBe("髙宮辰郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（田上修一君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("田上修一");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務部長（山田太郎君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副市長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副市長（田中一郎君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○市長（佐藤　義興君）　答弁します。"
    );
    expect(result.speakerName).toBe("佐藤義興");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務常任委員会委員長（鎌田文昭君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("鎌田文昭");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○健康増進課長（佐藤花子君）　お答えします。"
    );
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えします。");
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
○議長（北里秀和君）　ただいまから本日の会議を開きます。
○３番（髙宮辰郎君）　質問があります。
○市長（佐藤義興君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("北里秀和");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("髙宮辰郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("佐藤義興");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（北里秀和君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（北里秀和君）　ただいま。
○３番（髙宮辰郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（北里秀和君）　ただいまから会議を開きます。
○（３番　髙宮辰郎君登壇）
○３番（髙宮辰郎君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
