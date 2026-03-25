import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（山田太郎君）　それでは、ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（佐藤　次郎君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（鈴木花子君）　質問いたします。"
    );
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（田中一郎君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（高橋三郎君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（中村四郎君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("中村四郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○議会運営委員会委員長（伊藤五郎君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("伊藤五郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長は委員長より優先してマッチする", () => {
    const result = parseSpeaker(
      "○副委員長（渡辺六郎君）　報告します。"
    );
    expect(result.speakerRole).toBe("副委員長");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（佐藤　次郎君）　答弁します。"
    );
    expect(result.speakerName).toBe("佐藤次郎");
  });

  it("○ マーカーなしのテキスト", () => {
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
○議長（山田太郎君）　ただいまから本日の会議を開きます。
○３番（鈴木花子君）　質問があります。
○町長（佐藤次郎君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("鈴木花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("佐藤次郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山田太郎君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山田太郎君）　ただいま。
○３番（鈴木花子君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（山田太郎君）　ただいまから会議を開きます。
○（３番　鈴木花子君登壇）
○３番（鈴木花子君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("◯（丸印の別字体）マーカーにも対応する", () => {
    const text = "◯議長（山田太郎君）　テスト発言です。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });
});

describe("extractHeldOn", () => {
  it("令和年号の日付を抽出する", () => {
    expect(extractHeldOn("令和7年3月5日から開会")).toBe("2025-03-05");
  });

  it("平成年号の日付を抽出する", () => {
    expect(extractHeldOn("平成30年12月10日")).toBe("2018-12-10");
  });

  it("令和元年の日付を抽出する", () => {
    expect(extractHeldOn("令和元年9月12日")).toBe("2019-09-12");
  });

  it("日付がないテキストは null を返す", () => {
    expect(extractHeldOn("第1回定例会一般質問")).toBeNull();
  });

  it("テキストの途中にある日付も抽出できる", () => {
    expect(extractHeldOn("令和6年第2回定例会（令和6年6月18日）一般質問")).toBe("2024-06-18");
  });
});
