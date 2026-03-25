import { describe, expect, it } from "vitest";
import { parseListPage, parseLinkText, parseYearFromPageTitle, parseYearPage } from "./list";
import { convertWarekiYear, toHalfWidth } from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年３月５日")).toBe("令和6年3月5日");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });

  it("全角半角が混在する文字列を処理する", () => {
    expect(toHalfWidth("第１回定例市議会3月5日")).toBe("第1回定例市議会3月5日");
  });
});

describe("convertWarekiYear", () => {
  it("令和6年を2024年に変換する", () => {
    expect(convertWarekiYear("令和", "6")).toBe(2024);
  });

  it("令和元年を2019年に変換する", () => {
    expect(convertWarekiYear("令和", "元")).toBe(2019);
  });

  it("令和1年を2019年に変換する", () => {
    expect(convertWarekiYear("令和", "1")).toBe(2019);
  });

  it("平成30年を2018年に変換する", () => {
    expect(convertWarekiYear("平成", "30")).toBe(2018);
  });

  it("平成31年を2019年に変換する", () => {
    expect(convertWarekiYear("平成", "31")).toBe(2019);
  });

  it("未対応の元号はnullを返す", () => {
    expect(convertWarekiYear("大正", "10")).toBeNull();
  });
});

describe("parseYearFromPageTitle", () => {
  it("括弧内の西暦を抽出する", () => {
    expect(parseYearFromPageTitle("令和6年（2024年）会議録一覧")).toBe(2024);
  });

  it("半角括弧内の西暦を抽出する", () => {
    expect(parseYearFromPageTitle("令和6年(2024年)会議録一覧")).toBe(2024);
  });

  it("平成31・令和元年の西暦を抽出する", () => {
    expect(parseYearFromPageTitle("平成31・令和元年（2019年）会議録一覧")).toBe(2019);
  });

  it("和暦から西暦に変換する", () => {
    expect(parseYearFromPageTitle("令和6年会議録")).toBe(2024);
  });

  it("平成から西暦に変換する", () => {
    expect(parseYearFromPageTitle("平成30年の会議録")).toBe(2018);
  });

  it("年度情報がない場合はnullを返す", () => {
    expect(parseYearFromPageTitle("夕張市議会")).toBeNull();
  });
});

describe("parseLinkText", () => {
  it("定例市議会リンクテキストをパースする", () => {
    const result = parseLinkText("第1回定例市議会　3月5日", 2024);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例市議会 3月5日");
    // 夕張市は暦年ページのため、3月でも同じ年になる
    expect(result!.heldOn).toBe("2024-03-05");
    expect(result!.meetingType).toBe("plenary");
  });

  it("臨時市議会リンクテキストをパースする", () => {
    const result = parseLinkText("第2回臨時市議会　5月15日", 2024);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第2回臨時市議会 5月15日");
    expect(result!.heldOn).toBe("2024-05-15");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("行政常任委員会リンクテキストをパースする", () => {
    const result = parseLinkText("行政常任委員会　6月1日", 2024);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("行政常任委員会 6月1日");
    expect(result!.heldOn).toBe("2024-06-01");
    expect(result!.meetingType).toBe("committee");
  });

  it("予算審査委員会リンクテキストをパースする", () => {
    const result = parseLinkText("予算審査委員会　3月17日", 2024);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("予算審査委員会 3月17日");
    // 夕張市は暦年ページのため、3月でも同じ年になる
    expect(result!.heldOn).toBe("2024-03-17");
    expect(result!.meetingType).toBe("committee");
  });

  it("決算審査特別委員会リンクテキストをパースする", () => {
    const result = parseLinkText("決算審査特別委員会　9月15日", 2024);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("決算審査特別委員会 9月15日");
    expect(result!.heldOn).toBe("2024-09-15");
    expect(result!.meetingType).toBe("committee");
  });

  it("6月の会議は同じ年になる", () => {
    const result = parseLinkText("第2回定例市議会　6月10日", 2024);

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-06-10");
  });

  it("1月の会議も同じ年になる（暦年ページ）", () => {
    const result = parseLinkText("第1回定例市議会　1月20日", 2024);

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-01-20");
  });

  it("全角数字を含むテキストをパースする", () => {
    const result = parseLinkText("第１回定例市議会　３月５日", 2024);

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-03-05");
  });

  it("[PDFファイル／〇KB]の注記を除去してパースする", () => {
    const result = parseLinkText("第1回定例市議会　3月7日[PDFファイル／304KB]", 2024);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例市議会 3月7日");
    expect(result!.heldOn).toBe("2024-03-07");
  });

  it("パターンに合致しないテキストはnullを返す", () => {
    expect(parseLinkText("議事日程", 2024)).toBeNull();
    expect(parseLinkText("会議録一覧", 2024)).toBeNull();
    expect(parseLinkText("第1回定例市議会", 2024)).toBeNull();
  });
});

describe("parseListPage", () => {
  it("年度別ページのURLを収集する", () => {
    const html = `
      <html>
      <body>
        <a href="/site/gikai/3350.html">令和6年</a>
        <a href="/site/gikai/1757.html">令和5年</a>
        <a href="/site/gikai/1753.html">令和4年</a>
        <a href="/site/gikai/list13.html">会議録一覧</a>
      </body>
      </html>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://www.city.yubari.lg.jp/site/gikai/3350.html");
    expect(result[1]).toBe("https://www.city.yubari.lg.jp/site/gikai/1757.html");
    expect(result[2]).toBe("https://www.city.yubari.lg.jp/site/gikai/1753.html");
  });

  it("平成31・令和元年のような複合年度表記も収集する", () => {
    const html = `
      <a href="/site/gikai/1741.html">平成31・令和元年</a>
      <a href="/site/gikai/1740.html">平成30年</a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("https://www.city.yubari.lg.jp/site/gikai/1741.html");
    expect(result[1]).toBe("https://www.city.yubari.lg.jp/site/gikai/1740.html");
  });

  it("同じURLの重複を除外する", () => {
    const html = `
      <a href="/site/gikai/3350.html">令和6年</a>
      <a href="/site/gikai/3350.html">令和6年</a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
  });

  it("和暦年を含まないリンクは除外する", () => {
    const html = `
      <a href="/site/gikai/5198.html">議会日程</a>
      <a href="/site/gikai/1745.html">議決結果</a>
      <a href="/site/gikai/3350.html">令和6年</a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.city.yubari.lg.jp/site/gikai/3350.html");
  });

  it("gikai 以外のリンクは除外する", () => {
    const html = `
      <a href="/uploaded/attachment/12345.pdf">令和6年PDF</a>
      <a href="/site/top.html">令和6年トップ</a>
    `;

    expect(parseListPage(html)).toHaveLength(0);
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseListPage("<html><body>テキスト</body></html>")).toEqual([]);
  });
});

describe("parseYearPage", () => {
  it("年度別ページから PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>定例市議会</h3>
        <ul>
          <li><a href="/uploaded/attachment/10001.pdf">第1回定例市議会　3月5日[PDFファイル／300KB]</a></li>
          <li><a href="/uploaded/attachment/10002.pdf">第2回定例市議会　6月10日[PDFファイル／250KB]</a></li>
        </ul>
        <h3>行政常任委員会</h3>
        <ul>
          <li><a href="/uploaded/attachment/10003.pdf">行政常任委員会　6月1日[PDFファイル／200KB]</a></li>
        </ul>
        <a href="/site/gikai/list13.html">戻る</a>
      </body>
      </html>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(3);
    // 夕張市は暦年ページのため、3月でも同じ年になる
    expect(result[0]!.title).toBe("第1回定例市議会 3月5日");
    expect(result[0]!.heldOn).toBe("2024-03-05");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.yubari.lg.jp/uploaded/attachment/10001.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.year).toBe(2024);

    expect(result[1]!.title).toBe("第2回定例市議会 6月10日");
    expect(result[1]!.heldOn).toBe("2024-06-10");
    expect(result[1]!.meetingType).toBe("plenary");

    expect(result[2]!.title).toBe("行政常任委員会 6月1日");
    expect(result[2]!.heldOn).toBe("2024-06-01");
    expect(result[2]!.meetingType).toBe("committee");
  });

  it("PDF でないリンクは除外する", () => {
    const html = `
      <a href="/uploaded/attachment/10001.pdf">第1回定例市議会　3月5日[PDFファイル／300KB]</a>
      <a href="/site/gikai/list13.html">会議録一覧</a>
    `;

    const result = parseYearPage(html, 2024);
    expect(result).toHaveLength(1);
  });

  it("パースできないリンクテキストは除外する", () => {
    const html = `
      <a href="/uploaded/attachment/10001.pdf">議事日程[PDFファイル／100KB]</a>
      <a href="/uploaded/attachment/10002.pdf">第1回定例市議会　3月5日[PDFファイル／300KB]</a>
    `;

    const result = parseYearPage(html, 2024);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回定例市議会 3月5日");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません</p></div>`;
    expect(parseYearPage(html, 2024)).toEqual([]);
  });
});
