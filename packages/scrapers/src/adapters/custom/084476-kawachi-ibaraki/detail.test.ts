import { describe, expect, it } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  extractHeldOnFromText,
} from "./detail";
import { parseJapaneseDate } from "./shared";

describe("parseJapaneseDate", () => {
  it("令和6年12月5日を2024-12-05に変換する", () => {
    expect(parseJapaneseDate("令和6年12月5日")).toBe("2024-12-05");
  });

  it("令和元年5月1日を2019-05-01に変換する", () => {
    expect(parseJapaneseDate("令和元年5月1日")).toBe("2019-05-01");
  });

  it("平成24年6月15日を2012-06-15に変換する", () => {
    expect(parseJapaneseDate("平成24年6月15日")).toBe("2012-06-15");
  });

  it("全角数字を含む日付を変換する", () => {
    expect(parseJapaneseDate("令和６年１２月５日")).toBe("2024-12-05");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseJapaneseDate("2024年12月5日")).toBeNull();
    expect(parseJapaneseDate("")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長をパースする", () => {
    const result = parseSpeaker("○議長（田中義雄君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("田中義雄");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長をパースする", () => {
    const result = parseSpeaker("○町長（川又英雄君）　お答えいたします。");
    expect(result.speakerName).toBe("川又英雄");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員をパースする", () => {
    const result = parseSpeaker("○１番（山本豊君）　質問いたします。");
    expect(result.speakerName).toBe("山本豊");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長をパースする", () => {
    const result = parseSpeaker("○総務課長（佐藤一郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副議長をパースする", () => {
    const result = parseSpeaker("○副議長（鈴木花子君）　暫時休憩いたします。");
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩いたします。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時10分開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時10分開会");
  });

  it("カッコパターンなしで役職サフィックスにマッチする", () => {
    const result = parseSpeaker("○山田議長 発言します。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("発言します。");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("総務課長は answer（endsWith）", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○マーカーで発言を分割する", () => {
    const text =
      "○議長（田中義雄君）　ただいまから会議を開きます。\n○１番（山本豊君）　質問いたします。\n○町長（川又英雄君）　お答えいたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田中義雄");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.speakerName).toBe("山本豊");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("川又英雄");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ト書き（登壇）をスキップする", () => {
    const text =
      "○（山本豊君登壇）\n○１番（山本豊君）　質問いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("質問いたします。");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（田中義雄君）　ただいまから会議を開きます。";

    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "○議長（田中義雄君）　ただいま。\n○１番（山本豊君）　質問。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("○マーカーのないテキストはスキップする", () => {
    const text = "令和6年第4回 河内町議会定例会会議録\n午前10時10分開会";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });
});

describe("extractHeldOnFromText", () => {
  it("PDFテキスト冒頭の令和年月日を抽出する", () => {
    const text =
      "令和６年第４回\n河内町議会定例会会議録\n\n令和６年１２月５日\n\n１．出席議員";

    expect(extractHeldOnFromText(text)).toBe("2024-12-05");
  });

  it("全角数字を含む日付を抽出する", () => {
    const text = "平成２４年第１回\n河内町議会定例会会議録\n平成２４年３月１日";

    expect(extractHeldOnFromText(text)).toBe("2012-03-01");
  });

  it("日付が見つからない場合はnullを返す", () => {
    const text = "河内町議会定例会会議録";

    expect(extractHeldOnFromText(text)).toBeNull();
  });
});
