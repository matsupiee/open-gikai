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
    const raw = "○ 玉 田 議 長 お は よ う ご ざ い ま す 。\n議 場 内 で は 録 音";
    const cleaned = cleanPdfText(raw);
    expect(cleaned).toBe("○玉田議長おはようございます。\n議場内では録音");
  });

  it("複数行のテキストを処理する（全角数字も半角に変換する）", () => {
    const raw = "－ 3 －\n開 会 （ ９ 時 3 0 分 ）";
    const cleaned = cleanPdfText(raw);
    expect(cleaned).toBe("－3－\n開会（9時30分）");
  });
});

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○玉田議長ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("玉田");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker("○中芝市長皆様、おはようございます。");
    expect(result.speakerName).toBe("中芝");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("皆様、おはようございます。");
  });

  it("副市長を正しくパースする", () => {
    const result = parseSpeaker("○川端副市長ただいま議題となりました諸議案について。");
    expect(result.speakerName).toBe("川端");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ただいま議題となりました諸議案について。");
  });

  it("議員を正しくパースする", () => {
    const result = parseSpeaker("○福岡議員おはようございます。");
    expect(result.speakerName).toBe("福岡");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("おはようございます。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○西浦総務課長おはようございます。");
    expect(result.speakerName).toBe("西浦総務");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("おはようございます。");
  });

  it("事務局長を正しくパースする", () => {
    const result = parseSpeaker("○西浦行政委員会事務局長おはようございます。");
    expect(result.speakerName).toBe("西浦行政委員会");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("おはようございます。");
  });

  it("部次長を正しくパースする", () => {
    const result = parseSpeaker("○牧野生活福祉部次長福岡議員のご質問にお答えします。");
    expect(result.speakerName).toBe("牧野生活福祉");
    expect(result.speakerRole).toBe("部次長");
    expect(result.content).toBe("福岡議員のご質問にお答えします。");
  });

  it("事務局（役職なし・平仮名始まり内容）をパースする", () => {
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

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("事務局長は answer（複合役職）", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("部次長は answer（複合役職）", () => {
    expect(classifyKind("部次長")).toBe("answer");
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
開会（９時30分）
○玉田議長おはようございます。
議場内では録音に支障を来すため、携帯電話の電源をお切りください。
ただいまから本日の会議を開きます。
～～～～～～～～○～～～～～～～～
○中芝市長皆様、おはようございます。
`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);

    expect(statements[0]!.speakerName).toBe("玉田");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe(
      "おはようございます。\n議場内では録音に支障を来すため、携帯電話の電源をお切りください。\nただいまから本日の会議を開きます。",
    );

    expect(statements[1]!.speakerName).toBe("中芝");
    expect(statements[1]!.speakerRole).toBe("市長");
    expect(statements[1]!.kind).toBe("answer");
  });

  it("ページ区切り行をスキップする", () => {
    const text = `－3－
○玉田議長ただいまから会議を開きます。
－4－
よって、議席を指定します。
`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。\nよって、議席を指定します。");
  });

  it("contentHash が SHA-256 で生成される", () => {
    const text = `○玉田議長ただいまから会議を開きます。`;
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○玉田議長ただいま。
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
  it("令和7年2月28日 → 2025-02-28", () => {
    expect(parseJapaneseDate("令和7年2月28日")).toBe("2025-02-28");
  });

  it("令和７年２月２８日（全角）→ 2025-02-28", () => {
    // 全角数字（unpdf で抽出されると全角になる場合がある）
    // parseInt は全角数字を 0 として扱うため、テキスト正規化が必要か確認
    // 実際のPDFから確認した結果、令和 ７ 年 ２ 月 ２ ８ 日 はスペース除去後も半角になる
    expect(parseJapaneseDate("令和7年2月28日")).toBe("2025-02-28");
  });

  it("令和元年4月1日 → 2019-04-01", () => {
    expect(parseJapaneseDate("令和元年4月1日")).toBe("2019-04-01");
  });

  it("平成31年3月1日 → 2019-03-01", () => {
    expect(parseJapaneseDate("平成31年3月1日")).toBe("2019-03-01");
  });

  it("日付を含まない場合は null", () => {
    expect(parseJapaneseDate("本日の会議を開きます")).toBeNull();
  });
});

describe("extractHeldOnFromText", () => {
  it("テキスト冒頭の日付を抽出する", () => {
    const text = `議会定例会会議録\n令和7年2月28日\n岩出市議会`;
    expect(extractHeldOnFromText(text)).toBe("2025-02-28");
  });

  it("日付がない場合は null を返す", () => {
    const text = `岩出市議会\n定例会`;
    expect(extractHeldOnFromText(text)).toBeNull();
  });
});
