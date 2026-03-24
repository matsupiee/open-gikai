import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○議長（田中太郎）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○町長（鈴木次郎）　お答えいたします。");
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker("○２番（山本花子）　質問いたします。");
    expect(result.speakerName).toBe("山本花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（佐藤一郎）　お答えいたします。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("議会事務局長パターンを解析する", () => {
    const result = parseSpeaker("○議会事務局長（木村美子）　おはようございます。");
    expect(result.speakerName).toBe("木村美子");
    expect(result.speakerRole).toBe("議会事務局長");
    expect(result.content).toBe("おはようございます。");
  });

  it("臨時議長パターンを議長として解析する", () => {
    const result = parseSpeaker("○臨時議長（高橋三郎）　ただいまから臨時会を開会いたします。");
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから臨時会を開会いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("○企画課長（伊藤四郎）　ご説明いたします。");
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("○副町長（渡辺五郎）　ご報告いたします。");
    expect(result.speakerName).toBe("渡辺五郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("○建設課長（中村　六男）　ご報告いたします。");
    expect(result.speakerName).toBe("中村六男");
    expect(result.speakerRole).toBe("課長");
  });

  it("敬称付き（君）パターンにも対応する", () => {
    const result = parseSpeaker("○５番（小林七郎君）　質問があります。");
    expect(result.speakerName).toBe("小林七郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問があります。");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前９時30分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前９時30分 開会");
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

  it("議会事務局長は remark", () => {
    expect(classifyKind("議会事務局長")).toBe("remark");
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

  it("政策監は answer", () => {
    expect(classifyKind("政策監")).toBe("answer");
  });

  it("会計管理者は answer", () => {
    expect(classifyKind("会計管理者")).toBe("answer");
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
○議長（田中太郎）　ただいまから本日の会議を開きます。
○２番（山本花子）　質問があります。
○町長（鈴木次郎）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田中太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("山本花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木次郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○議長（田中太郎）　テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中太郎）　ただいま。
○２番（山本花子）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（田中太郎）　ただいまから会議を開きます。
（２番　山本花子登壇）
○２番（山本花子）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("議会事務局長の発言を remark として分類する", () => {
    const text = `○議会事務局長（木村美子）　おはようございます。私は議会事務局長の木村と申します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("木村美子");
    expect(statements[0]!.speakerRole).toBe("議会事務局長");
  });
});
