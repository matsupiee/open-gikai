import { describe, expect, it } from "vitest";
import {
  cleanPdfText,
  parseSpeaker,
  classifyKind,
  parseStatements,
  parseJapaneseDate,
  extractHeldOnFromText,
} from "./detail";

describe("cleanPdfText", () => {
  it("行ごとにスペースを除去する", () => {
    const raw = "○ 山 田 議 長 お は よ う ご ざ い ま す 。\n議 場 内 で は 録 音";
    const cleaned = cleanPdfText(raw);
    expect(cleaned).toBe("○山田議長おはようございます。\n議場内では録音");
  });

  it("全角数字を半角に変換する", () => {
    const raw = "令 和 ７ 年 １ ２ 月 １ ０ 日";
    const cleaned = cleanPdfText(raw);
    expect(cleaned).toBe("令和7年12月10日");
  });

  it("ページ番号行（全角ハイフン）を保持する", () => {
    const raw = "－ 3 －";
    const cleaned = cleanPdfText(raw);
    expect(cleaned).toBe("－3－");
  });
});

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○山田議長ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○田中町長お答えいたします。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○鈴木副町長ご説明いたします。");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副委員長を正しくパースする（長い方を優先）", () => {
    const result = parseSpeaker("○佐藤副委員長審議します。");
    expect(result.speakerName).toBe("佐藤");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("審議します。");
  });

  it("議員を正しくパースする", () => {
    const result = parseSpeaker("○山本一郎議員質問いたします。");
    expect(result.speakerName).toBe("山本一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長を正しくパースする（複合役職）", () => {
    const result = parseSpeaker("○西浦総務課長おはようございます。");
    expect(result.speakerName).toBe("西浦総務");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("おはようございます。");
  });

  it("事務局長を正しくパースする", () => {
    const result = parseSpeaker("○小林事務局長ご報告申し上げます。");
    expect(result.speakerName).toBe("小林");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("○マーカーあり・役職不明の場合は漢字名前のみ", () => {
    const result = parseSpeaker("○事務局ただいまの報告を申し上げます。");
    expect(result.speakerName).toBe("事務局");
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("ただいまの報告を申し上げます。");
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("事務局長は answer（複合役職）", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("発言ブロックを正しく抽出する", () => {
    const text = `－3－
開会（9時30分）
○山田議長おはようございます。
議場内では録音に支障を来すため、携帯電話の電源をお切りください。
ただいまから本日の会議を開きます。
～～～～～～～～○～～～～～～～～
○田中町長皆様、おはようございます。
`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);

    expect(statements[0]!.speakerName).toBe("山田");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe(
      "おはようございます。\n議場内では録音に支障を来すため、携帯電話の電源をお切りください。\nただいまから本日の会議を開きます。",
    );

    expect(statements[1]!.speakerName).toBe("田中");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");
  });

  it("ページ区切り行をスキップする", () => {
    const text = `－3－
○山田議長ただいまから会議を開きます。
－4－
よって、議席を指定します。
`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。\nよって、議席を指定します。");
  });

  it("contentHash が SHA-256 で生成される", () => {
    const text = `○山田議長ただいまから会議を開きます。`;
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○山田議長ただいま。
○田中議員質問です。
`;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言が0件の場合は空配列を返す", () => {
    const text = `－1－\n議事日程\n日程第１議席の指定`;
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});

describe("parseJapaneseDate", () => {
  it("令和7年12月10日 → 2025-12-10", () => {
    expect(parseJapaneseDate("令和7年12月10日")).toBe("2025-12-10");
  });

  it("令和元年5月1日 → 2019-05-01", () => {
    expect(parseJapaneseDate("令和元年5月1日")).toBe("2019-05-01");
  });

  it("平成31年3月1日 → 2019-03-01", () => {
    expect(parseJapaneseDate("平成31年3月1日")).toBe("2019-03-01");
  });

  it("平成元年4月1日 → 1989-04-01", () => {
    expect(parseJapaneseDate("平成元年4月1日")).toBe("1989-04-01");
  });

  it("日付を含まない場合は null", () => {
    expect(parseJapaneseDate("本日の会議を開きます")).toBeNull();
  });
});

describe("extractHeldOnFromText", () => {
  it("テキスト冒頭の日付を抽出する", () => {
    const text = `議会定例会会議録\n令和7年12月10日\n美浜町議会`;
    expect(extractHeldOnFromText(text)).toBe("2025-12-10");
  });

  it("日付がない場合は null を返す", () => {
    const text = `美浜町議会\n定例会`;
    expect(extractHeldOnFromText(text)).toBeNull();
  });
});
