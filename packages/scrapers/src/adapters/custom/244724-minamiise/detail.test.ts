import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseHeldOn } from "./detail";

describe("parseHeldOn", () => {
  it("令和の日付をYYYY-MM-DDに変換する", () => {
    expect(parseHeldOn("令和6年3月4日（月曜日）開会")).toBe("2024-03-04");
    expect(parseHeldOn("令和7年6月12日")).toBe("2025-06-12");
  });

  it("平成の日付を変換する", () => {
    expect(parseHeldOn("平成30年12月10日")).toBe("2018-12-10");
  });

  it("令和元年を変換する", () => {
    expect(parseHeldOn("令和元年9月3日")).toBe("2019-09-03");
  });

  it("全角数字の日付も変換する", () => {
    expect(parseHeldOn("令和６年３月４日")).toBe("2024-03-04");
  });

  it("日付が解析できない場合はnullを返す", () => {
    expect(parseHeldOn("審議結果")).toBeNull();
    expect(parseHeldOn("")).toBeNull();
    expect(parseHeldOn("3月4日")).toBeNull();
  });

  it("年なし月日 + fallbackYear でYYYY-MM-DDを生成する", () => {
    // 審議結果 PDF は年なしで月日のみ含む場合がある
    expect(parseHeldOn("1月15日 可 決", 2024)).toBe("2024-01-15");
    expect(parseHeldOn("3月4日 可 決", 2024)).toBe("2024-03-04");
    expect(parseHeldOn("9月10日 可 決", 2023)).toBe("2023-09-10");
  });

  it("fallbackYearがなければ月日のみではnullを返す", () => {
    expect(parseHeldOn("3月4日")).toBeNull();
    expect(parseHeldOn("1月15日")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長パターンを解析する", () => {
    const result = parseSpeaker("山田太郎議長 本日の会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("本日の会議を開きます。");
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeaker("鈴木一郎町長 お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("田中副町長 ご説明いたします。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("中村教育長 お答えいたします。");
    expect(result.speakerName).toBe("中村");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("事務局長パターンを解析する（局長より先にマッチ）", () => {
    const result = parseSpeaker("伊藤事務局長 おはようございます。");
    expect(result.speakerName).toBe("伊藤");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("おはようございます。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker("３番 佐藤花子議員 質問いたします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("高橋総務課長 ご説明いたします。");
    expect(result.speakerName).toBe("高橋総務");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("日程番号プレフィックスを除去してパースする", () => {
    const result = parseSpeaker("日程第１ 山田太郎議長 会議録署名議員の指名を行います。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("会議録署名議員の指名を行います。");
  });

  it("役職が不明なテキストはspeakerRole=nullを返す", () => {
    const result = parseSpeaker("南伊勢町議会第１回定例会審議結果");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
  });
});

describe("classifyKind", () => {
  it("議長はremark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長はremark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長はremark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長はremark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("町長はanswer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長はanswer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長はanswer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("副教育長はanswer", () => {
    expect(classifyKind("副教育長")).toBe("answer");
  });

  it("部長はanswer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長はanswer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員はquestion", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("nullはremark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("空行で段落を分割してstatementを抽出する", () => {
    const text = [
      "南伊勢町議会令和6年第1回定例会審議結果",
      "",
      "令和6年3月15日（金曜日）",
      "",
      "議案第1号 南伊勢町一般会計補正予算（第1号）について 原案可決",
      "",
      "議案第2号 南伊勢町国民健康保険特別会計補正予算（第1号）について 原案可決",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThan(0);
    // 各 statement にcontentHashが付与される
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("各statementにcontentHashが付与される", () => {
    const text = [
      "南伊勢町議会令和6年第1回定例会審議結果",
      "",
      "議案第1号 南伊勢町一般会計補正予算（第1号）について 原案可決",
    ].join("\n");

    const statements = parseStatements(text);
    for (const stmt of statements) {
      expect(stmt.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("offsetが正しく計算される", () => {
    const text = [
      "南伊勢町議会令和6年第1回定例会審議結果",
      "",
      "議案第1号 南伊勢町一般会計補正予算（第1号）について 原案可決",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(statements[0]!.content.length);
    if (statements.length > 1) {
      expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
    }
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("5文字未満の短いブロックは除外する", () => {
    const text = [
      "AB",
      "",
      "南伊勢町議会令和6年第1回定例会審議結果",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements.every((s) => s.content.length >= 5)).toBe(true);
  });

  it("番号付き議員パターンのブロックをquestion種別で抽出する", () => {
    const text = [
      "令和6年9月10日",
      "",
      "３番 田中一郎議員 南伊勢町の観光振興について",
    ].join("\n");

    const statements = parseStatements(text);
    const questionStmt = statements.find((s) => s.speakerRole === "議員");
    expect(questionStmt).toBeDefined();
    expect(questionStmt!.kind).toBe("question");
    expect(questionStmt!.speakerName).toBe("田中一郎");
  });
});
