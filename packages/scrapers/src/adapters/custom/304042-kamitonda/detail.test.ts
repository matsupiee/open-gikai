import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（田中一郎君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（山田次郎君）　お答えいたします。");
    expect(result.speakerName).toBe("山田次郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○３番（鈴木太郎君）　質問いたします。");
    expect(result.speakerName).toBe("鈴木太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（佐藤花子君）　ご説明いたします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（伊藤一郎君）　ご報告します。");
    expect(result.speakerName).toBe("伊藤一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告します。");
  });

  it("部長を正しくパースする", () => {
    const result = parseSpeaker("○建設部長（渡辺二郎君）　説明します。");
    expect(result.speakerName).toBe("渡辺二郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("説明します。");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言を分割する", () => {
    const text = `○議長（田中一郎君）　ただいまから本日の会議を開きます。
○３番（鈴木太郎君）　質問いたします。
○町長（山田次郎君）　お答えいたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("田中一郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("鈴木太郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("山田次郎");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ト書き（登壇）をスキップする", () => {
    const text = `○３番（鈴木太郎君）（登壇）
○３番（鈴木太郎君）　質問いたします。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("質問いたします。");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = `○議長（田中一郎君）　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中一郎君）　ただいま。
○３番（鈴木太郎君）　質問です。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言のない PDF テキストは空配列を返す", () => {
    const text = "上富田町議会 令和6年 第4回定例会 会議録";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
