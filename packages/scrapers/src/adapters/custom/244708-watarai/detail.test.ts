import { describe, expect, it } from "vitest";
import { parseSpeakerLine, classifyKind, parseStatements, parseHeldOn } from "./detail";

describe("parseHeldOn", () => {
  it("招集年月日パターンから日付を抽出する", () => {
    const text = "令和７年第１回度会町議会定例会会議録\n招集年月日\n\n令和７年３月４日\n\n招集場所";
    expect(parseHeldOn(text)).toBe("2025-03-04");
  });

  it("令和の日付をYYYY-MM-DDに変換する", () => {
    expect(parseHeldOn("招集年月日\n令和6年9月10日")).toBe("2024-09-10");
    expect(parseHeldOn("招集年月日\n令和5年3月7日")).toBe("2023-03-07");
  });

  it("平成の日付を変換する", () => {
    expect(parseHeldOn("招集年月日\n平成30年3月6日")).toBe("2018-03-06");
  });

  it("令和元年を変換する", () => {
    expect(parseHeldOn("招集年月日\n令和元年6月11日")).toBe("2019-06-11");
  });

  it("全角数字の日付も変換する", () => {
    expect(parseHeldOn("招集年月日\n令和７年３月４日")).toBe("2025-03-04");
  });

  it("開議パターンからも日付を抽出する", () => {
    expect(parseHeldOn("開議\n令和6年9月10日（午前9時00分）")).toBe("2024-09-10");
  });

  it("テキスト内の最初の和暦日付をフォールバックとして使う", () => {
    expect(parseHeldOn("令和7年3月4日（午前9時00分）")).toBe("2025-03-04");
  });

  it("日付が解析できない場合はnullを返す", () => {
    expect(parseHeldOn("度会町議会定例会会議録")).toBeNull();
    expect(parseHeldOn("")).toBeNull();
  });
});

describe("parseSpeakerLine", () => {
  it("○議長（氏名）パターンを解析する", () => {
    const result = parseSpeakerLine("○議長（若宮　淳也）");
    expect(result.speakerName).toBe("若宮　淳也");
    expect(result.speakerRole).toBe("議長");
    expect(result.isHeader).toBe(true);
  });

  it("○町長（氏名）パターンを解析する", () => {
    const result = parseSpeakerLine("○町長（中村　忠彦）");
    expect(result.speakerName).toBe("中村　忠彦");
    expect(result.speakerRole).toBe("町長");
    expect(result.isHeader).toBe(true);
  });

  it("○副町長（氏名）パターンを解析する", () => {
    const result = parseSpeakerLine("○副町長（西岡　一義）");
    expect(result.speakerName).toBe("西岡　一義");
    expect(result.speakerRole).toBe("副町長");
    expect(result.isHeader).toBe(true);
  });

  it("○N番（氏名）パターンを解析して議員と判定する", () => {
    const result = parseSpeakerLine("○１番（山北　佳宏）");
    expect(result.speakerName).toBe("山北　佳宏");
    expect(result.speakerRole).toBe("議員");
    expect(result.isHeader).toBe(true);
  });

  it("○で始まらない行はisHeader=falseを返す", () => {
    const result = parseSpeakerLine("通常のテキストです。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.isHeader).toBe(false);
  });

  it("括弧がない○行はisHeader=trueだがspeakerNameはnull", () => {
    const result = parseSpeakerLine("○議長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.isHeader).toBe(true);
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
  it("○発言者行と発言内容をstatementとして抽出する", () => {
    const text = [
      "令和７年第１回度会町議会定例会会議録",
      "○議長（若宮　淳也） 開会いたします。",
      "○町長（中村　忠彦） お答えいたします。度会町では農業振興に力を入れています。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThan(0);
    const gicho = statements.find((s) => s.speakerRole === "議長");
    expect(gicho).toBeDefined();
    expect(gicho!.kind).toBe("remark");
    expect(gicho!.speakerName).toBe("若宮　淳也");
  });

  it("◎議事区切り行をremark種別として抽出する", () => {
    const text = [
      "◎開会の宣告",
      "○議長（若宮　淳也） ただいまの出席議員は11名です。",
    ].join("\n");

    const statements = parseStatements(text);

    const section = statements.find((s) => s.content === "開会の宣告");
    expect(section).toBeDefined();
    expect(section!.kind).toBe("remark");
    expect(section!.speakerName).toBeNull();
  });

  it("○N番（氏名）パターンをquestion種別として抽出する", () => {
    const text = [
      "○１番（山北　佳宏） 農業振興政策についてお伺いします。具体的には補助金制度の見直しについて質問します。",
    ].join("\n");

    const statements = parseStatements(text);

    const question = statements.find((s) => s.speakerRole === "議員");
    expect(question).toBeDefined();
    expect(question!.kind).toBe("question");
    expect(question!.speakerName).toBe("山北　佳宏");
  });

  it("各statementにcontentHashが付与される", () => {
    const text = [
      "◎開会の宣告",
      "○議長（若宮　淳也） 本日の会議を開きます。議事日程に従って進めます。",
    ].join("\n");

    const statements = parseStatements(text);

    for (const stmt of statements) {
      expect(stmt.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("offsetが正しく計算される", () => {
    const text = [
      "◎開会の宣告",
      "○議長（若宮　淳也） 本日の会議を開きます。",
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

  it("5文字未満のブロックは除外する", () => {
    const text = [
      "AB",
      "◎開会の宣告",
      "○議長（若宮　淳也） 本日の会議を開きます。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements.every((s) => s.content.length >= 3)).toBe(true);
  });
});
