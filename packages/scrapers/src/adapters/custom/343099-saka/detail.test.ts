import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（田中太郎君）　それでは、ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（山田花子君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（鈴木一郎君）　質問いたします。",
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("全角番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１０番（佐藤次郎君）　一般質問をします。",
    );
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("議員");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（佐藤二郎君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("佐藤二郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する（役職名付き）", () => {
    const result = parseSpeaker(
      "○総務課長（田中太郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副委員長（渡辺三郎君）　採決します。",
    );
    expect(result.speakerName).toBe("渡辺三郎");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（山田　花子君）　答弁します。",
    );
    expect(result.speakerName).toBe("山田花子");
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

describe("extractHeldOn", () => {
  it("和暦＋月日パターンから日付を抽出する", () => {
    expect(extractHeldOn("令和6年3月5日", null)).toBe("2024-03-05");
    expect(extractHeldOn("令和7年12月20日", null)).toBe("2025-12-20");
  });

  it("令和元年を正しく処理する", () => {
    expect(extractHeldOn("令和元年6月10日", null)).toBe("2019-06-10");
  });

  it("平成の日付を処理する", () => {
    expect(extractHeldOn("平成30年3月5日", null)).toBe("2018-03-05");
  });

  it("西暦＋月日パターンから日付を抽出する", () => {
    expect(extractHeldOn("2024年3月5日", null)).toBe("2024-03-05");
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(extractHeldOn("会議録テキスト", null)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（田中太郎君）　ただいまから本日の会議を開きます。
○３番（鈴木一郎君）　質問があります。
○町長（山田花子君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田中太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("鈴木一郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("山田花子");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（田中太郎君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中太郎君）　ただいま。
○３番（鈴木一郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（田中太郎君）　ただいまから会議を開きます。
（３番　鈴木一郎君登壇）
○３番（鈴木一郎君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("kind の型は string であること", () => {
    const statements = parseStatements(
      "○議長（田中太郎君）　開会します。",
    );
    expect(typeof statements[0]!.kind).toBe("string");
  });
});
