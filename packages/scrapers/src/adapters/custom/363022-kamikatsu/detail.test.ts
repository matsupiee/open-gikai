import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（山田太郎君） ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（鈴木一郎君） お答えいたします。"
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務常任委員長（田中二郎君） 委員会の審査結果を報告します。"
    );
    expect(result.speakerName).toBe("田中二郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("委員会の審査結果を報告します。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（佐藤三郎君） ご説明いたします。"
    );
    expect(result.speakerName).toBe("佐藤三郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（伊藤四郎君） 質問いたします。"
    );
    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（渡辺五郎君） ご報告いたします。"
    );
    expect(result.speakerName).toBe("渡辺五郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副議長（中村六郎君） ただいまより議会を開会します。"
    );
    expect(result.speakerName).toBe("中村六郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("ただいまより議会を開会します。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○議長（山田 太郎君） 発言します。"
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
  });

  it("スペース区切りパターンを解析する", () => {
    const result = parseSpeaker("○議長 山田 発言します。");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("山田 発言します。");
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("理事は answer", () => {
    expect(classifyKind("理事")).toBe("answer");
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
○議長（山田太郎君） ただいまから本日の会議を開きます。
○３番（伊藤四郎君） 質問があります。
○町長（鈴木一郎君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("伊藤四郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山田太郎君） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山田太郎君） ただいま。
○３番（伊藤四郎君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。
（３番　伊藤四郎君登壇）
○３番（伊藤四郎君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○総務課長（佐藤三郎君） ご説明いたします。
○副町長（渡辺五郎君） ご報告いたします。
○教育長（高田稔君） お答えいたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("副町長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("教育長");
  });

  it("委員会パターンを正しく処理する", () => {
    const text = `○総務常任委員長（田中二郎君） 委員会の審査結果を報告します。
○委員（木村七郎君） 賛成します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("委員長");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("委員");
  });
});
