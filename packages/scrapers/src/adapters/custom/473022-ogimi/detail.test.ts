import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（田中太郎君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("村長を正しくパースする", () => {
    const result = parseSpeaker("○村長（山田一郎君）　お答えいたします。");
    expect(result.speakerName).toBe("山田一郎");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副村長を正しくパースする", () => {
    const result = parseSpeaker("○副村長（鈴木次郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○３番（佐藤三郎君）　一般質問いたします。");
    expect(result.speakerName).toBe("佐藤三郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（高橋四郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("高橋四郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長を正しくパースする（委員長より先にマッチ）", () => {
    const result = parseSpeaker("○副委員長（伊藤五郎君）　ご報告申し上げます。");
    expect(result.speakerName).toBe("伊藤五郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("課長を正しくパースする（建設課長）", () => {
    const result = parseSpeaker("○建設課長（渡辺六郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("渡辺六郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("カッコパターンなし・役職あり", () => {
    const result = parseSpeaker("○渡辺議長 ただいまから会議を開きます。");
    expect(result.speakerName).toBe("渡辺");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
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

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("建設課長は answer（endsWith マッチ）", () => {
    expect(classifyKind("建設課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言を分割して抽出する", () => {
    const text = `
○議長（田中太郎君）　ただいまから本日の会議を開きます。
○３番（佐藤次郎君）　一般質問いたします。
○村長（山田一郎君）　お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田中太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("佐藤次郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("山田一郎");
    expect(statements[2]!.speakerRole).toBe("村長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ト書き（登壇）をスキップする", () => {
    const text = `
○３番（佐藤次郎君）（登壇）
○３番（佐藤次郎君）　一般質問いたします。
    `.trim();

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("一般質問いたします。");
  });

  it("contentHash が SHA-256 の hex 文字列である", () => {
    const text = `○議長（田中太郎君）　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中君）　ただいま。\n○議員（佐藤君）　質問です。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("○ マーカーがないブロックはスキップする", () => {
    const text = `会議を開会します。\n○議長（田中君）　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("発言内容が空のブロックはスキップする", () => {
    const text = `○議長（田中君）\n○議員（佐藤君）　質問します。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議員");
  });

  it("statements が空の場合は空配列を返す", () => {
    const text = "会議録テキストに発言マーカーなし";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
