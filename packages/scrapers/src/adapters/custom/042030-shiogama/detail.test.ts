import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（佐藤一郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker("○市長（田中次郎君）　お答えいたします。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○1番（鈴木三郎君）　質問いたします。");
    expect(result.speakerName).toBe("鈴木三郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("全角番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○１番（山田花子君）　質問します。");
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("課長を正しくパースする（複合役職名）", () => {
    const result = parseSpeaker("○総務課長（高橋五郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("高橋五郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（中村六郎君）　お答えします。");
    expect(result.speakerName).toBe("中村六郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えします。");
  });

  it("副市長を正しくパースする", () => {
    const result = parseSpeaker("○副市長（小林七郎君）　説明いたします。");
    expect(result.speakerName).toBe("小林七郎");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("説明いたします。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("○副議長（加藤八郎君）　議事を進めます。");
    expect(result.speakerName).toBe("加藤八郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("議事を進めます。");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("○委員長（伊藤九郎君）　開会します。");
    expect(result.speakerName).toBe("伊藤九郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("開会します。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後1時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後1時開議");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("複合役職（総務課長）は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○マーカーで区切られた発言を抽出する", () => {
    const text = `
○議長（佐藤一郎君）　ただいまから会議を開きます。
○1番（鈴木三郎君）　質問いたします。
○市長（田中次郎君）　お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("佐藤一郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.speakerName).toBe("鈴木三郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("田中次郎");
    expect(statements[2]!.speakerRole).toBe("市長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("登壇ト書きをスキップする", () => {
    const text = `○市長（田中次郎君）（登壇）
○議長（佐藤一郎君）　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("contentHash が SHA-256 ハッシュ形式で生成される", () => {
    const text = "○議長（佐藤一郎君）　ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（佐藤一郎君）　ただいま。
○1番（鈴木三郎君）　質問です。`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言がない場合は空配列を返す", () => {
    const text = "会議録の内容はありません。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
