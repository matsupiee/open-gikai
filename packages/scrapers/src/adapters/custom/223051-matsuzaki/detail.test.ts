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

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（田中次郎君） 補足説明いたします。"
    );
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("補足説明いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務委員長（佐藤三郎君） 報告します。"
    );
    expect(result.speakerName).toBe("佐藤三郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("報告します。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（野口加代子君） 質問いたします。"
    );
    expect(result.speakerName).toBe("野口加代子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○建設部長（高橋四郎君） ご説明いたします。"
    );
    expect(result.speakerName).toBe("高橋四郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（伊藤五郎君） 教育施策についてお答えします。"
    );
    expect(result.speakerName).toBe("伊藤五郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("教育施策についてお答えします。");
  });

  it("スペース区切りの役職パターンを解析する", () => {
    const result = parseSpeaker(
      "○渡辺議長 ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("渡辺");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○議長（吉田 稔君） それでは報告します。"
    );
    expect(result.speakerName).toBe("吉田稔");
    expect(result.speakerRole).toBe("議長");
  });

  it("○マーカーなしのテキスト", () => {
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
○３番（野口加代子君） 質問があります。
○町長（鈴木一郎君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("野口加代子");
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
○３番（野口加代子君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。
（３番　野口加代子君登壇）
○３番（野口加代子君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○副町長（田中次郎君） 補足説明いたします。
○建設部長（高橋四郎君） ご説明いたします。
○教育長（伊藤五郎君） お答えいたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("副町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("部長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("教育長");
  });
});
