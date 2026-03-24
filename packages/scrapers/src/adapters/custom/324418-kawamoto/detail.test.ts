import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長をパースする（カッコパターン）", () => {
    const result = parseSpeaker("○議長（田中太郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長をパースする（カッコパターン）", () => {
    const result = parseSpeaker("○町長（山田一郎君）　お答えいたします。");
    expect(result.speakerName).toBe("山田一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長をパースする（カッコパターン）", () => {
    const result = parseSpeaker("○副町長（鈴木二郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("鈴木二郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員をパースする（カッコパターン）", () => {
    const result = parseSpeaker("○３番（佐藤次郎君）　質問いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長をパースする（複合役職名+カッコパターン）", () => {
    const result = parseSpeaker("○建設課長（木村三郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("木村三郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("スペース区切りパターンで議長をパースする", () => {
    const result = parseSpeaker("◯田中議長 ただいまから会議を開きます。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("スペース区切りパターンで副議長をパースする", () => {
    const result = parseSpeaker("◯山田副議長 発言を許可します。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("発言を許可します。");
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
  it("○マーカーで発言を分割する", () => {
    const text = `
○議長（田中太郎君）　ただいまから会議を開きます。
○３番（佐藤次郎君）　質問いたします。
○町長（山田一郎君）　お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田中太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.speakerName).toBe("佐藤次郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("山田一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("登壇・着席のト書きをスキップする", () => {
    const text = `
○議長（田中太郎君）（登壇）
○議長（田中太郎君）　ただいまから会議を開きます。
    `.trim();

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");
  });

  it("contentHash が SHA-256 64文字の hex 文字列で生成される", () => {
    const text = `○議長（田中太郎君）　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中太郎君）　ただいま。\n○３番（佐藤次郎君）　質問です。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言内容が空のブロックはスキップする", () => {
    const text = `○議長（田中太郎君）　`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("○マーカーなしのテキストはスキップする", () => {
    const text = `
第１回定例会
川本町議会会議録
○議長（田中太郎君）　ただいまから会議を開きます。
    `.trim();

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });
});
