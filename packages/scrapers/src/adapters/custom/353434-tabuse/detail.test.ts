import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("○議長（田中一郎君） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("○町長（山田太郎君） 皆さん、おはようございます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker("○総務委員長（鈴木次郎君） おはようございます。");
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("おはようございます。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("○副町長（伊藤三郎君） お答えします。");
    expect(result.speakerName).toBe("伊藤三郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("お答えします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（高橋四郎君） ご説明いたします。");
    expect(result.speakerName).toBe("高橋四郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker("○総務部長（渡辺五郎君） 補足説明をさせていただきます。");
    expect(result.speakerName).toBe("渡辺五郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("補足説明をさせていただきます。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker("○１番（佐藤花子君） 質問いたします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("○文教厚生委員長（山本 義男君） それでは報告します。");
    expect(result.speakerName).toBe("山本義男");
    expect(result.speakerRole).toBe("委員長");
  });

  it("次長パターンを解析する", () => {
    const result = parseSpeaker("○企画部次長（中村六郎君） ご説明いたします。");
    expect(result.speakerName).toBe("中村六郎");
    expect(result.speakerRole).toBe("次長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前１０時００分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時００分 開会");
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("次長は answer", () => {
    expect(classifyKind("次長")).toBe("answer");
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
○議長（田中一郎君） ただいまから本日の会議を開きます。
○１番（佐藤花子君） 質問があります。
○町長（山田太郎君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田中一郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐藤花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("山田太郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○議長（田中一郎君） テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中一郎君） ただいま。
○１番（佐藤花子君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（田中一郎君） ただいまから会議を開きます。
（１番　佐藤花子君登壇）
○１番（佐藤花子君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○総務部長（渡辺五郎君） 補足説明いたします。
○教育長（高橋四郎君） お答えいたします。
○副町長（伊藤三郎君） 回答します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("部長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("教育長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("副町長");
  });
});
