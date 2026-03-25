import { describe, expect, it } from "vitest";
import {
  parseTopPageLinks,
  parseYearPagePdfs,
  parseKessanPage,
  parseSessionMonth,
  parseDayNumber,
} from "./list";
import { parseJapaneseYear, buildHeldOn, detectMeetingType } from "./shared";

describe("parseJapaneseYear", () => {
  it("令和年度を変換する", () => {
    expect(parseJapaneseYear("令和6年")).toBe(2024);
    expect(parseJapaneseYear("令和7年")).toBe(2025);
    expect(parseJapaneseYear("令和2年")).toBe(2020);
  });

  it("令和元年を変換する", () => {
    expect(parseJapaneseYear("令和元年")).toBe(2019);
  });

  it("平成年度を変換する", () => {
    expect(parseJapaneseYear("平成30年")).toBe(2018);
    expect(parseJapaneseYear("平成18年")).toBe(2006);
  });

  it("全角数字を処理する", () => {
    expect(parseJapaneseYear("令和７年")).toBe(2025);
    expect(parseJapaneseYear("令和６年")).toBe(2024);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseJapaneseYear("2024年")).toBeNull();
    expect(parseJapaneseYear("Unknown")).toBeNull();
    expect(parseJapaneseYear("")).toBeNull();
  });
});

describe("buildHeldOn", () => {
  it("YYYY-MM-DD形式に変換する", () => {
    expect(buildHeldOn(2024, 3, 1)).toBe("2024-03-01");
    expect(buildHeldOn(2024, 12, 4)).toBe("2024-12-04");
    expect(buildHeldOn(2025, 9, 2)).toBe("2025-09-02");
  });

  it("月日を2桁にゼロパディングする", () => {
    expect(buildHeldOn(2024, 1, 5)).toBe("2024-01-05");
    expect(buildHeldOn(2024, 9, 3)).toBe("2024-09-03");
  });
});

describe("detectMeetingType", () => {
  it("定例会を識別する", () => {
    expect(detectMeetingType("12月定例会")).toBe("plenary");
    expect(detectMeetingType("3月定例会")).toBe("plenary");
  });

  it("臨時会を識別する", () => {
    expect(detectMeetingType("5月臨時会")).toBe("extraordinary");
  });

  it("委員会を識別する", () => {
    expect(detectMeetingType("決算審査特別委員会")).toBe("committee");
  });
});

describe("parseSessionMonth", () => {
  it("会議名から月を抽出する", () => {
    expect(parseSessionMonth("12月定例会")).toBe(12);
    expect(parseSessionMonth("9月定例会")).toBe(9);
    expect(parseSessionMonth("3月定例会")).toBe(3);
    expect(parseSessionMonth("6月定例会")).toBe(6);
    expect(parseSessionMonth("5月臨時会")).toBe(5);
  });

  it("全角数字を処理する", () => {
    expect(parseSessionMonth("１２月定例会")).toBe(12);
    expect(parseSessionMonth("９月定例会")).toBe(9);
  });

  it("月が含まれない場合はnullを返す", () => {
    expect(parseSessionMonth("決算審査特別委員会")).toBeNull();
    expect(parseSessionMonth("定例会")).toBeNull();
  });
});

describe("parseDayNumber", () => {
  it("N日目から日番号を抽出する", () => {
    expect(parseDayNumber("1日目")).toBe(1);
    expect(parseDayNumber("2日目")).toBe(2);
    expect(parseDayNumber("3日目")).toBe(3);
    expect(parseDayNumber("10日目")).toBe(10);
  });

  it("全角数字を処理する", () => {
    expect(parseDayNumber("１日目")).toBe(1);
    expect(parseDayNumber("２日目")).toBe(2);
  });

  it("N日目でない場合はnullを返す", () => {
    expect(parseDayNumber("日程表")).toBeNull();
    expect(parseDayNumber("目次")).toBeNull();
    expect(parseDayNumber("3月4日")).toBeNull();
  });
});

describe("parseTopPageLinks", () => {
  it("年度ページリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/chosei/_1010/_1414/_7097.html">令和7年</a></li>
          <li><a href="/chosei/_1010/_1414/_6753.html">令和6年</a></li>
          <li><a href="/chosei/_1010/_1414/_5163.html">令和5年</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseTopPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      year: 2025,
      url: "https://www.town.tara.lg.jp/chosei/_1010/_1414/_7097.html",
    });
    expect(result[1]).toEqual({
      year: 2024,
      url: "https://www.town.tara.lg.jp/chosei/_1010/_1414/_6753.html",
    });
    expect(result[2]).toEqual({
      year: 2023,
      url: "https://www.town.tara.lg.jp/chosei/_1010/_1414/_5163.html",
    });
  });

  it("年度に対応しないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/chosei/_1010/_1414/_1454.html">決算審査特別委員会</a></li>
        <li><a href="/chosei/_1010/_1414/_7097.html">令和7年</a></li>
        <li><a href="/chosei/_1010/_1414.html">戻る</a></li>
      </ul>
    `;

    const result = parseTopPageLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
  });

  it("重複するURLを除外する", () => {
    const html = `
      <a href="/chosei/_1010/_1414/_7097.html">令和7年</a>
      <a href="/chosei/_1010/_1414/_7097.html">令和7年</a>
    `;

    const result = parseTopPageLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>リンクなし</p>";
    expect(parseTopPageLinks(html)).toEqual([]);
  });

  it("平成年度のリンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="/chosei/_1010/_1414/_1453.html">平成18年</a></li>
        <li><a href="/chosei/_1010/_1414/_1452.html">平成19年</a></li>
      </ul>
    `;

    const result = parseTopPageLinks(html);
    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2006);
    expect(result[1]!.year).toBe(2007);
  });
});

describe("parseYearPagePdfs", () => {
  it("定例会の会議録PDFレコードを抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>12月定例会</h3>
        <ul>
          <li><a href="/var/rev0/0012/8533/12541415469.pdf">日程表</a> (PDFファイル; 103KB)</li>
          <li><a href="/var/rev0/0012/8534/125414154754.pdf">目次</a> (PDFファイル; 107KB)</li>
          <li><a href="/var/rev0/0012/8535/12541415489.pdf">1日目</a> (PDFファイル; 442KB)</li>
          <li><a href="/var/rev0/0012/8536/125414154820.pdf">2日目</a> (PDFファイル; 634KB)</li>
          <li><a href="/var/rev0/0012/8537/125414154829.pdf">3日目</a> (PDFファイル; 545KB)</li>
        </ul>
      </body>
      </html>
    `;

    const result = parseYearPagePdfs(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_6753.html",
      2024
    );

    // 日程表と目次は除外
    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("令和6年12月定例会 1日目");
    expect(result[0]!.heldOn).toBe("2024-12-01");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tara.lg.jp/var/rev0/0012/8535/12541415489.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.title).toBe("令和6年12月定例会 2日目");
    expect(result[1]!.heldOn).toBe("2024-12-02");
    expect(result[2]!.title).toBe("令和6年12月定例会 3日目");
    expect(result[2]!.heldOn).toBe("2024-12-03");
  });

  it("複数の定例会を処理する", () => {
    const html = `
      <div>
        <h3>12月定例会</h3>
        <ul>
          <li><a href="/var/rev0/0019/9914/file1.pdf">1日目</a></li>
          <li><a href="/var/rev0/0019/9915/file2.pdf">2日目</a></li>
        </ul>
        <h3>9月定例会</h3>
        <ul>
          <li><a href="/var/rev0/0019/9920/file3.pdf">1日目</a></li>
          <li><a href="/var/rev0/0019/9921/file4.pdf">2日目</a></li>
          <li><a href="/var/rev0/0019/9922/file5.pdf">3日目</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPagePdfs(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_6753.html",
      2024
    );

    expect(result).toHaveLength(5);
    expect(result[0]!.title).toBe("令和6年12月定例会 1日目");
    expect(result[0]!.heldOn).toBe("2024-12-01");
    expect(result[2]!.title).toBe("令和6年9月定例会 1日目");
    expect(result[2]!.heldOn).toBe("2024-09-01");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <div>
        <h3>5月臨時会</h3>
        <ul>
          <li><a href="/var/rev0/0019/9930/file.pdf">1日目</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPagePdfs(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_6753.html",
      2024
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.title).toBe("令和6年5月臨時会 1日目");
    expect(result[0]!.heldOn).toBe("2024-05-01");
  });

  it("日程表・目次を除外する", () => {
    const html = `
      <div>
        <h3>3月定例会</h3>
        <ul>
          <li><a href="/var/rev0/0019/9914/nichitei.pdf">日程表</a></li>
          <li><a href="/var/rev0/0019/9914/mokuji.pdf">目次</a></li>
          <li><a href="/var/rev0/0019/9914/file.pdf">1日目</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPagePdfs(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_7097.html",
      2025
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2025-03-01");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `<div><h3>3月定例会</h3><ul><li>リンクなし</li></ul></div>`;
    const result = parseYearPagePdfs(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_7097.html",
      2025
    );
    expect(result).toEqual([]);
  });

  it("/var/rev0/ 以外のPDFリンクは無視する", () => {
    const html = `
      <div>
        <h3>3月定例会</h3>
        <ul>
          <li><a href="/other/path/file.pdf">1日目</a></li>
          <li><a href="/var/rev0/0019/9914/file.pdf">2日目</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPagePdfs(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_7097.html",
      2025
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2025-03-02");
  });

  it("yearPageUrl を正しく記録する", () => {
    const html = `
      <div>
        <h3>3月定例会</h3>
        <ul>
          <li><a href="/var/rev0/0019/9914/file.pdf">1日目</a></li>
        </ul>
      </div>
    `;

    const yearPageUrl = "https://www.town.tara.lg.jp/chosei/_1010/_1414/_7097.html";
    const result = parseYearPagePdfs(html, yearPageUrl, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.yearPageUrl).toBe(yearPageUrl);
  });

  it("平成年度も正しく処理する", () => {
    const html = `
      <div>
        <h3>12月定例会</h3>
        <ul>
          <li><a href="/var/rev0/0001/3209/h1812_kaigiroku_01.pdf">1日目</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPagePdfs(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_1453.html",
      2006
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("平成18年12月定例会 1日目");
    expect(result[0]!.heldOn).toBe("2006-12-01");
  });
});

describe("parseKessanPage", () => {
  it("指定年度の決算審査特別委員会レコードを抽出する", () => {
    const html = `
      <div>
        <h3>令和6年度決算審査特別委員会</h3>
        <ul>
          <li><a href="/var/rev0/0019/9940/file1.pdf">1日目</a></li>
          <li><a href="/var/rev0/0019/9941/file2.pdf">2日目</a></li>
          <li><a href="/var/rev0/0019/9942/file3.pdf">3日目</a></li>
        </ul>
        <h3>令和5年度決算審査特別委員会</h3>
        <ul>
          <li><a href="/var/rev0/0018/9840/file1.pdf">1日目</a></li>
        </ul>
      </div>
    `;

    const result = parseKessanPage(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_1454.html",
      2024
    );

    expect(result).toHaveLength(3);
    expect(result[0]!.meetingType).toBe("committee");
    expect(result[0]!.title).toBe("令和6年度決算審査特別委員会 1日目");
    expect(result[0]!.heldOn).toBe("2024-09-01");
    expect(result[1]!.heldOn).toBe("2024-09-02");
  });

  it("対象年度以外はスキップする", () => {
    const html = `
      <div>
        <h3>令和6年度決算審査特別委員会</h3>
        <ul>
          <li><a href="/var/rev0/0019/9940/file1.pdf">1日目</a></li>
        </ul>
        <h3>令和5年度決算審査特別委員会</h3>
        <ul>
          <li><a href="/var/rev0/0018/9840/file1.pdf">1日目</a></li>
        </ul>
      </div>
    `;

    const result = parseKessanPage(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_1454.html",
      2023
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2023-09-01");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `<div><h3>令和6年度決算審査特別委員会</h3></div>`;
    const result = parseKessanPage(
      html,
      "https://www.town.tara.lg.jp/chosei/_1010/_1414/_1454.html",
      2024
    );
    expect(result).toEqual([]);
  });
});
