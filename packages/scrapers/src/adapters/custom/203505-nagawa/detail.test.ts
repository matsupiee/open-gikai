import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（森田公明君） ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("森田公明");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（羽田健一郎君） お答えいたします。"
    );
    expect(result.speakerName).toBe("羽田健一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（藤田仁史君） お答えいたします。"
    );
    expect(result.speakerName).toBe("藤田仁史");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○企画財政課長（藤田健司君） ご説明します。"
    );
    expect(result.speakerName).toBe("藤田健司");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明します。");
  });

  it("全角番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○６番（羽田公夫君） 質問いたします。"
    );
    expect(result.speakerName).toBe("羽田公夫");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker(
      "○事務局長（米沢正君） ご報告します。"
    );
    expect(result.speakerName).toBe("米沢正");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご報告します。");
  });

  it("土地開発公社理事長パターンを解析する", () => {
    const result = parseSpeaker(
      "○土地開発公社理事長（高見沢高明君） ご説明いたします。"
    );
    expect(result.speakerName).toBe("高見沢高明");
    expect(result.speakerRole).toBe("土地開発公社理事長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("代表監査委員パターンを解析する", () => {
    const result = parseSpeaker(
      "○代表監査委員（丸山淳子君） 報告します。"
    );
    expect(result.speakerName).toBe("丸山淳子");
    expect(result.speakerRole).toBe("代表監査委員");
    expect(result.content).toBe("報告します。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○議長（森田　公明君） 開会します。"
    );
    expect(result.speakerName).toBe("森田公明");
    expect(result.speakerRole).toBe("議長");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分 開会");
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

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("土地開発公社理事長は answer", () => {
    expect(classifyKind("土地開発公社理事長")).toBe("answer");
  });

  it("代表監査委員は answer", () => {
    expect(classifyKind("代表監査委員")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseHeldOn", () => {
  it("令和の日付を抽出する", () => {
    const text = "令和6年3月1日\n長和町議会定例会\n○議長（森田君） 開会します。";
    expect(parseHeldOn(text, 2024)).toBe("2024-03-01");
  });

  it("全角数字の日付を抽出する", () => {
    const text = "令和６年３月１日\n長和町議会定例会";
    expect(parseHeldOn(text, 2024)).toBe("2024-03-01");
  });

  it("令和元年の日付を抽出する", () => {
    const text = "令和元年12月5日\n長和町議会第4回定例会";
    expect(parseHeldOn(text, 2019)).toBe("2019-12-05");
  });

  it("日付が見つからない場合はnullを返す", () => {
    expect(parseHeldOn("長和町議会会議録", 2024)).toBeNull();
    expect(parseHeldOn("", 2024)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（森田公明君） ただいまから本日の会議を開きます。
○６番（羽田公夫君） 質問があります。
○町長（羽田健一郎君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("森田公明");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("羽田公夫");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("羽田健一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（森田公明君） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（森田公明君） ただいま。
○６番（羽田公夫君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（森田公明君） ただいまから会議を開きます。
（６番　羽田公夫君登壇）
○６番（羽田公夫君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○副町長（山田二郎君） ご説明いたします。
○教育長（藤田仁史君） お答えいたします。
○企画財政課長（藤田健司君） ご報告します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("副町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("教育長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("課長");
  });
});
