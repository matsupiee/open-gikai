import { describe, expect, test } from "vitest";
import {
  normalizeFullWidth,
  extractDate,
  detectMeetingType,
  stripHtmlTags,
  decodeShiftJis,
  percentEncodeBytes,
} from "./_shared";

describe("normalizeFullWidth", () => {
  test("全角数字を半角に変換", () => {
    expect(normalizeFullWidth("０１２３４５６７８９")).toBe("0123456789");
  });

  test("半角数字はそのまま", () => {
    expect(normalizeFullWidth("0123456789")).toBe("0123456789");
  });

  test("数字以外はそのまま", () => {
    expect(normalizeFullWidth("令和６年")).toBe("令和6年");
  });
});

describe("extractDate", () => {
  test("和暦（令和）から日付を抽出", () => {
    expect(extractDate("令和6年3月15日")).toBe("2024-03-15");
  });

  test("和暦（平成）から日付を抽出", () => {
    expect(extractDate("平成31年4月1日")).toBe("2019-04-01");
  });

  test("和暦（昭和）から日付を抽出", () => {
    expect(extractDate("昭和60年12月25日")).toBe("1985-12-25");
  });

  test("全角数字の和暦", () => {
    expect(extractDate("令和６年３月１５日")).toBe("2024-03-15");
  });

  test("西暦の日付（YYYY年MM月DD日）", () => {
    expect(extractDate("2024年3月15日")).toBe("2024-03-15");
  });

  test("西暦の日付（YYYY-MM-DD）", () => {
    expect(extractDate("2024-3-15")).toBe("2024-03-15");
  });

  test("西暦の日付（YYYY/MM/DD）", () => {
    expect(extractDate("2024/3/15")).toBe("2024-03-15");
  });

  test("日付が見つからない場合は null", () => {
    expect(extractDate("日付なし")).toBeNull();
  });

  test("月日が1桁でもゼロパディング", () => {
    expect(extractDate("令和6年1月5日")).toBe("2024-01-05");
  });
});

describe("detectMeetingType", () => {
  test("委員会 → committee", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });

  test("臨時会 → extraordinary", () => {
    expect(detectMeetingType("令和６年臨時会")).toBe("extraordinary");
  });

  test("定例会 → plenary", () => {
    expect(detectMeetingType("令和６年第１回定例会")).toBe("plenary");
  });
});

describe("stripHtmlTags", () => {
  test("HTML タグを除去", () => {
    expect(stripHtmlTags("<b>太字</b><i>斜体</i>")).toBe("太字斜体");
  });

  test("script/style タグをコンテンツごと除去", () => {
    expect(
      stripHtmlTags(
        '<script>alert("xss")</script>テキスト<style>.x{}</style>'
      )
    ).toBe("テキスト");
  });

  test("HTML エンティティをデコード", () => {
    expect(stripHtmlTags("&amp; &lt; &gt; &quot; &nbsp;")).toBe('& < > "');
  });
});

describe("decodeShiftJis", () => {
  test("ASCII バイト列をデコード", () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(decodeShiftJis(bytes)).toBe("Hello");
  });
});

describe("percentEncodeBytes", () => {
  test("各バイトを %XX 形式にエンコード", () => {
    const bytes = new Uint8Array([0x41, 0x42, 0x00, 0xff]);
    expect(percentEncodeBytes(bytes)).toBe("%41%42%00%FF");
  });
});
