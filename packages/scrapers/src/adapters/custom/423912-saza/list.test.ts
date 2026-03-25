import { describe, expect, it } from "vitest";
import {
  convertWarekiToWesternYear,
  detectMeetingType,
  toHalfWidth,
} from "./shared";
import {
  extractYearFromPageHtml,
  normalizePdfLinkText,
  parseDateFromLinkText,
  parseDetailPage,
  parseTopPage,
  parseYearListPage,
} from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年")).toBe("令和6年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertWarekiToWesternYear", () => {
  it("令和の年を変換する", () => {
    expect(convertWarekiToWesternYear("令和6年")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(convertWarekiToWesternYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertWarekiToWesternYear("平成30年")).toBe(2018);
    expect(convertWarekiToWesternYear("平成28年")).toBe(2016);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertWarekiToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("第4回定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });

  it("委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("全員協議会")).toBe("committee");
    expect(detectMeetingType("決算審査特別委員会")).toBe("committee");
  });
});

describe("parseTopPage", () => {
  it("classArea2 内から年度別一覧ページへのリンクを抽出する", () => {
    const html = `
      <div class="classArea2">
        <a href="/gikai/list01312.html">令和6年</a>
        <a href="/gikai/list01265.html">令和5年</a>
        <a href="/gikai/list01241.html">令和4年</a>
      </div>
    `;

    const result = parseTopPage(html);

    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.some((r) => r.listUrl.includes("list01312"))).toBe(true);
    expect(result.some((r) => r.listUrl.includes("list01265"))).toBe(true);
  });

  it("list{listID}.html 以外のリンクはスキップする", () => {
    const html = `
      <div class="classArea2">
        <a href="/gikai/list01312.html">令和6年</a>
        <a href="/gikai/top.html">トップ</a>
        <a href="/gikai/kiji6115/index.html">会議詳細</a>
      </div>
    `;

    const result = parseTopPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.listUrl).toContain("list01312");
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseTopPage("<div>リンクなし</div>")).toEqual([]);
  });
});

describe("parseYearListPage", () => {
  it("kijilist 内から会議詳細ページへのリンクを抽出する", () => {
    const html = `
      <ul class="kijilist">
        <li><a href="/gikai/kiji6115/index.html">第4回定例会</a></li>
        <li><a href="/gikai/kiji6090/index.html">第3回定例会</a></li>
        <li><a href="/gikai/kiji6050/index.html">第1回臨時会</a></li>
      </ul>
    `;

    const result = parseYearListPage(
      html,
      "https://www.sazacho-nagasaki.jp/gikai/list01312.html",
    );

    expect(result).toHaveLength(3);
    expect(result[0]!.meetingName).toBe("第4回定例会");
    expect(result[0]!.detailUrl).toContain("kiji6115");
    expect(result[1]!.meetingName).toBe("第3回定例会");
    expect(result[2]!.meetingName).toBe("第1回臨時会");
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(
      parseYearListPage(
        "<ul></ul>",
        "https://www.sazacho-nagasaki.jp/gikai/list01312.html",
      ),
    ).toEqual([]);
  });
});

describe("extractYearFromPageHtml", () => {
  it("titleタグから和暦年を抽出する", () => {
    const html = `
      <html>
        <head><title>令和6年 議会 | 佐々町</title></head>
        <body></body>
      </html>
    `;

    expect(extractYearFromPageHtml(html)).toBe(2024);
  });

  it("見出しタグから和暦年を抽出する", () => {
    const html = `
      <html>
        <body>
          <h2>令和5年 会議録一覧</h2>
        </body>
      </html>
    `;

    expect(extractYearFromPageHtml(html)).toBe(2023);
  });

  it("ページ本文から和暦年を抽出する", () => {
    const html = `<div>平成30年度の会議録</div>`;

    expect(extractYearFromPageHtml(html)).toBe(2018);
  });

  it("和暦が含まれない場合はnullを返す", () => {
    expect(extractYearFromPageHtml("<div>2024年</div>")).toBeNull();
  });
});

describe("parseDateFromLinkText", () => {
  it("月日パターンを抽出する", () => {
    expect(parseDateFromLinkText("12月17日（1日目）")).toEqual({
      month: 12,
      day: 17,
    });
  });

  it("1桁の月日も抽出できる", () => {
    expect(parseDateFromLinkText("3月5日（1日目）")).toEqual({
      month: 3,
      day: 5,
    });
  });

  it("月日がない場合はnullを返す", () => {
    expect(parseDateFromLinkText("第4回定例会")).toBeNull();
  });
});

describe("normalizePdfLinkText", () => {
  it("PDFサイズ表記を除去する", () => {
    expect(normalizePdfLinkText("12月17日（1日目）（PDF：974.7キロバイト）")).toBe(
      "12月17日（1日目）",
    );
  });

  it("全角数字を半角に変換する", () => {
    expect(normalizePdfLinkText("１２月１７日（１日目）")).toBe(
      "12月17日（1日目）",
    );
  });
});

describe("parseDetailPage", () => {
  it("danraku 内から PDF リンクを抽出する", () => {
    const html = `
      <div class="danraku">
        <a href="/gikai/kiji6115/3_6115_9722_up_j8xommrm.pdf">12月17日（1日目）（PDF：974.7キロバイト）</a>
        <a href="/gikai/kiji6115/3_6115_9723_up_abc12345.pdf">12月18日（2日目）（PDF：1010.6キロバイト）</a>
      </div>
    `;

    const result = parseDetailPage(
      html,
      "https://www.sazacho-nagasaki.jp/gikai/kiji6115/index.html",
      "第4回定例会",
      2024,
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("第4回定例会 12月17日（1日目）");
    expect(result[0]!.pdfUrl).toContain("3_6115_9722_up_j8xommrm.pdf");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.heldOn).toBe("2024-12-17");
    expect(result[1]!.title).toBe("第4回定例会 12月18日（2日目）");
    expect(result[1]!.heldOn).toBe("2024-12-18");
  });

  it("臨時会は meetingType が extraordinary になる", () => {
    const html = `
      <div class="danraku">
        <a href="/gikai/kiji5900/3_5900_1234_up_abc.pdf">6月5日（1日目）（PDF：500.0キロバイト）</a>
      </div>
    `;

    const result = parseDetailPage(
      html,
      "https://www.sazacho-nagasaki.jp/gikai/kiji5900/index.html",
      "第1回臨時会",
      2024,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div class="danraku"><p>会議録はありません</p></div>`;

    const result = parseDetailPage(
      html,
      "https://www.sazacho-nagasaki.jp/gikai/kiji9999/index.html",
      "第4回定例会",
      2024,
    );

    expect(result).toEqual([]);
  });
});
