import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（田端雅樹君） ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("田端雅樹");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("市長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○市長（松本啓太郎君） 皆さん、おはようございます。"
    );
    expect(result.speakerName).toBe("松本啓太郎");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務常任委員長（中村幸男君） ただいまから委員会を開きます。"
    );
    expect(result.speakerName).toBe("中村幸男");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ただいまから委員会を開きます。");
  });

  it("副市長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副市長（田中一郎君） ご説明いたします。"
    );
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務部長（山田太郎君） 補足説明いたします。"
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("補足説明いたします。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（野口花子君） 質問いたします。"
    );
    expect(result.speakerName).toBe("野口花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（佐藤次郎君） お答えいたします。"
    );
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○文教厚生常任委員長（吉田 稔君） それでは報告します。"
    );
    expect(result.speakerName).toBe("吉田稔");
    expect(result.speakerRole).toBe("委員長");
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
○議長（田端雅樹君） ただいまから本日の会議を開きます。
○３番（野口花子君） 質問があります。
○市長（松本啓太郎君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田端雅樹");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("野口花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("松本啓太郎");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（田端雅樹君） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田端雅樹君） ただいま。
○３番（野口花子君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（田端雅樹君） ただいまから会議を開きます。
（３番　野口花子君登壇）
○３番（野口花子君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○総務部長（山田太郎君） 補足説明いたします。
○教育長（佐藤次郎君） お答えいたします。
○副市長（田中一郎君） ご説明します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("部長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("教育長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("副市長");
  });
});

describe("extractHeldOn", () => {
  it("平成タイトルから開催日を推定する", () => {
    expect(extractHeldOn("平成28年第4回定例会(10月)議事録", "2016-12-08")).toBe("2016-10-01");
    expect(extractHeldOn("平成28年第3回臨時会(9月)議事録", "2016-12-08")).toBe("2016-09-01");
  });

  it("令和タイトルから開催日を推定する", () => {
    expect(extractHeldOn("令和6年第4回定例会(12月)議事録", "2025-01-10")).toBe("2024-12-01");
  });

  it("タイトルに月が含まれない場合は null を返す", () => {
    expect(extractHeldOn("平成28年第4回定例会議事録", "2016-12-08")).toBeNull();
  });

  it("和暦が解析できない場合は null を返す", () => {
    expect(extractHeldOn("第4回定例会(10月)議事録", "2016-12-08")).toBeNull();
  });
});
