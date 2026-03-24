import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名 役職フォーマット）を正しくパースする", () => {
    const result = parseSpeaker("○ 上原祐希 議長 ただいまの出席議員は11名です。");
    expect(result.speakerName).toBe("上原祐希");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまの出席議員は11名です。");
  });

  it("村長を正しくパースする", () => {
    const result = parseSpeaker("○ 久田浩也 村長 皆さんおはようございます。");
    expect(result.speakerName).toBe("久田浩也");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("皆さんおはようございます。");
  });

  it("副村長を正しくパースする", () => {
    const result = parseSpeaker("○ 山田太郎 副村長 ご説明いたします。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○ 鈴木花子 教育長 ご報告いたします。");
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("議席番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○ 5番 石嶺美奈実 一般質問いたします。");
    expect(result.speakerName).toBe("石嶺美奈実");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問いたします。");
  });

  it("副委員長を正しくパースする（委員長より先にマッチ）", () => {
    const result = parseSpeaker("○ 田中一郎 副委員長 ご報告申し上げます。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("課長（総務課長）を正しくパースする", () => {
    const result = parseSpeaker("○ 佐藤次郎 総務課長 ご報告いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("括弧パターン（フォールバック）を正しくパースする", () => {
    const result = parseSpeaker("○議長（田中太郎君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("括弧パターンの番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○３番（佐藤三郎君）　一般質問いたします。");
    expect(result.speakerName).toBe("佐藤三郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問いたします。");
  });

  it("事務局長を正しくパースする", () => {
    const result = parseSpeaker("○ 渡辺六郎 事務局長 ご説明いたします。");
    expect(result.speakerName).toBe("渡辺六郎");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご説明いたします。");
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

  it("総務課長は answer（endsWith マッチ）", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
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
○ 上原祐希 議長 ただいまの出席議員は11名です。
○ 5番 石嶺美奈実 一般質問いたします。
○ 久田浩也 村長 お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("上原祐希");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまの出席議員は11名です。");

    expect(statements[1]!.speakerName).toBe("石嶺美奈実");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("久田浩也");
    expect(statements[2]!.speakerRole).toBe("村長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ト書き（登壇）をスキップする", () => {
    const text = `
○5番（石嶺美奈実）（登壇）
○ 5番 石嶺美奈実 一般質問いたします。
    `.trim();

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("一般質問いたします。");
  });

  it("contentHash が SHA-256 の hex 文字列である", () => {
    const text = `○ 上原祐希 議長 ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○ 上原祐希 議長 ただいま。\n○ 石嶺 議員 質問です。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("○ マーカーがないブロックはスキップする", () => {
    const text = `会議を開会します。\n○ 上原祐希 議長 ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("発言内容が空のブロックはスキップする", () => {
    const text = `○ 上原祐希 議長\n○ 石嶺 議員 質問します。`;

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
