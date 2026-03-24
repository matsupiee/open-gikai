import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseDateFromText } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（山田太郎君） ただいまから本日の会議を開きます。",
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（鈴木一郎君） 皆さん、おはようございます。",
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（佐藤花子君） 質問いたします。",
    );
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（田中正樹君） ご説明いたします。",
    );
    expect(result.speakerName).toBe("田中正樹");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（中村二郎君） お答えいたします。",
    );
    expect(result.speakerName).toBe("中村二郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（伊藤三郎君） 補足いたします。",
    );
    expect(result.speakerName).toBe("伊藤三郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("補足いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○議長（山田 太郎君） 開会します。",
    );
    expect(result.speakerName).toBe("山田太郎");
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
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

describe("parseDateFromText", () => {
  it("令和の日付を抽出する", () => {
    expect(parseDateFromText("令和6年12月10日開会")).toBe("2024-12-10");
  });

  it("令和元年を変換する", () => {
    expect(parseDateFromText("令和元年3月5日")).toBe("2019-03-05");
  });

  it("平成の日付を抽出する", () => {
    expect(parseDateFromText("平成30年6月11日招集")).toBe("2018-06-11");
  });

  it("テキスト中の最初の日付を返す", () => {
    expect(
      parseDateFromText("令和6年12月10日から令和6年12月15日まで"),
    ).toBe("2024-12-10");
  });

  it("日付がない場合はnullを返す", () => {
    expect(parseDateFromText("会議録テキスト")).toBeNull();
  });

  it("平成24年（最古の記録年度）を正しく変換する", () => {
    expect(parseDateFromText("平成24年3月1日")).toBe("2012-03-01");
  });

  it("文字間スペースありの全角数字形式を解析する（PDF由来）", () => {
    expect(
      parseDateFromText("令 和 ６ 年 １ ２ 月 １ ０ 日 午 前 ９ 時"),
    ).toBe("2024-12-10");
  });

  it("全角数字の日付を解析する", () => {
    expect(parseDateFromText("令和６年１２月１０日")).toBe("2024-12-10");
  });
});

describe("parseStatements", () => {
  it("○マーカーでテキストを分割する", () => {
    const text = `
○議長（山田太郎君） ただいまから本日の会議を開きます。
○３番（佐藤花子君） 質問があります。
○町長（鈴木一郎君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐藤花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山田太郎君） テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山田太郎君） ただいま。
○３番（佐藤花子君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。
○（３番　佐藤花子君登壇）
○３番（佐藤花子君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○総務課長（田中正樹君） ご説明いたします。
○教育長（中村二郎君） お答えいたします。
○副町長（伊藤三郎君） 補足いたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("教育長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("副町長");
  });
});
