import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  parseDateFromPdf,
  parseTitleFromPdf,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（飯沼　満君）　それでは、ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("飯沼満");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("副議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○副議長（小川榮一君）　議長の代理をいたします。"
    );
    expect(result.speakerName).toBe("小川榮一");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("議長の代理をいたします。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（藤井弘之君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("藤井弘之");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（金指義樹君）　ご説明します。"
    );
    expect(result.speakerName).toBe("金指義樹");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明します。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（宇野秀宣君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("宇野秀宣");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○５番（西脇博文君）　質問いたします。"
    );
    expect(result.speakerName).toBe("西脇博文");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("兼務役職の長い名前を正しく解析する", () => {
    const result = parseSpeaker(
      "○総務部長兼総務課長兼危機管理監（河出真志君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("河出真志");
    expect(result.speakerRole).toBe("危機管理監");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("産業建設部長兼企業誘致推進室長パターンを解析する", () => {
    const result = parseSpeaker(
      "○産業建設部長兼企業誘致推進室長（土屋典生君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("土屋典生");
    expect(result.speakerRole).toBe("室長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○議長（飯  沼  満君）　開会します。"
    );
    expect(result.speakerName).toBe("飯沼満");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("半角数字の番号議員パターン", () => {
    const result = parseSpeaker(
      "○8番（飯沼　満君）　動議を提出いたします。"
    );
    expect(result.speakerName).toBe("飯沼満");
    expect(result.speakerRole).toBe("議員");
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

  it("危機管理監は answer", () => {
    expect(classifyKind("危機管理監")).toBe("answer");
  });

  it("室長は answer", () => {
    expect(classifyKind("室長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseDateFromPdf", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateFromPdf("令和 ７ 年 ３ 月 ３ 日  開会")).toBe(
      "2025-03-03"
    );
  });

  it("スペースなしの令和日付をパースする", () => {
    expect(parseDateFromPdf("令和7年3月3日")).toBe("2025-03-03");
  });

  it("令和元年に対応する", () => {
    expect(parseDateFromPdf("令和元年5月1日")).toBe("2019-05-01");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateFromPdf("平成31年4月30日")).toBe("2019-04-30");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromPdf("目次")).toBeNull();
  });
});

describe("parseTitleFromPdf", () => {
  it("定例会タイトルを抽出する", () => {
    expect(
      parseTitleFromPdf("令和７年第２回神戸町議会定例会会議録目次")
    ).toBe("令和7年第2回神戸町議会定例会");
  });

  it("臨時会タイトルを抽出する", () => {
    expect(
      parseTitleFromPdf("令和７年第１回神戸町議会臨時会会議録")
    ).toBe("令和7年第1回神戸町議会臨時会");
  });

  it("タイトルがない場合は null を返す", () => {
    expect(parseTitleFromPdf("出席議員一覧")).toBeNull();
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（飯沼　満君）　ただいまから本日の会議を開きます。
○５番（西脇博文君）　質問があります。
○町長（藤井弘之君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("飯沼満");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("西脇博文");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("藤井弘之");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（飯沼　満君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（飯沼　満君）　ただいま。
○５番（西脇博文君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（飯沼　満君）　ただいまから会議を開きます。
○（５番　西脇博文君登壇）
○５番（西脇博文君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("兼務役職の発言を正しく分類する", () => {
    const text =
      "○総務部長兼総務課長兼危機管理監（河出真志君）　ご説明いたします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("危機管理監");
    expect(statements[0]!.speakerName).toBe("河出真志");
  });
});
