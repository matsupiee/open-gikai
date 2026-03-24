import { describe, it, expect } from "vitest";
import { parseIndexPage, parseYearPage, parseSectionDate, parseDayFromCell } from "./list";

describe("parseIndexPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/34/33327.html">令和7年</a></li>
        <li><a href="/soshiki/34/25687.html">令和6年</a></li>
        <li><a href="/soshiki/34/17005.html">令和5年</a></li>
      </ul>
    `;

    const pages = parseIndexPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年");
    expect(pages[0]!.url).toBe(
      "https://www.city.miyoshi.hiroshima.jp/soshiki/34/33327.html"
    );
    expect(pages[1]!.label).toBe("令和6年");
    expect(pages[2]!.label).toBe("令和5年");
  });

  it("令和・平成を含まないリンクはスキップする", () => {
    const html = `
      <a href="/soshiki/34/999.html">お知らせ一覧</a>
      <a href="/soshiki/34/33327.html">令和7年</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年");
  });

  it(".html なしのリンクにも .html を付与する", () => {
    const html = `
      <a href="/soshiki/34/33327">令和7年</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.url).toContain(".html");
  });
});

describe("parseSectionDate", () => {
  it("令和の半角セクション見出しから年月を取得する", () => {
    expect(parseSectionDate("令和6年12月定例会")).toBe("2024-12");
  });

  it("令和の全角セクション見出しから年月を取得する", () => {
    expect(parseSectionDate("令和６年１２月定例会")).toBe("2024-12");
  });

  it("平成のセクション見出しから年月を取得する", () => {
    expect(parseSectionDate("平成30年3月定例会")).toBe("2018-03");
  });

  it("令和元年に対応する", () => {
    expect(parseSectionDate("令和元年9月定例会")).toBe("2019-09");
  });

  it("平成31年に対応する", () => {
    expect(parseSectionDate("平成31年3月定例会")).toBe("2019-03");
  });

  it("臨時会も取得できる", () => {
    expect(parseSectionDate("令和6年第1回臨時会（令和6年4月）")).toBe("2024-04");
  });

  it("パースできない場合は null を返す", () => {
    expect(parseSectionDate("資料一覧")).toBeNull();
  });
});

describe("parseDayFromCell", () => {
  it("月日（曜日）形式から日付を取得する", () => {
    expect(parseDayFromCell("12月2日（月曜日）", "2024-12")).toBe("2024-12-02");
  });

  it("全角数字の日付を取得する", () => {
    expect(parseDayFromCell("３月１日（火曜日）", "2024-03")).toBe("2024-03-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDayFromCell("内容テキスト", "2024-12")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.city.miyoshi.hiroshima.jp/soshiki/34/25687.html";

  it("h2 見出しとテーブルから PDF リンクを抽出する", () => {
    const html = `
      <h2>令和6年12月定例会</h2>
      <table>
        <tr>
          <td>12月2日（月曜日）</td>
          <td><a href="/uploaded/attachment/111111.pdf">令和6年12月定例会 第1日目会議録 [PDFファイル／500KB]</a></td>
        </tr>
        <tr>
          <td>12月3日（火曜日）</td>
          <td><a href="/uploaded/attachment/222222.pdf">令和6年12月定例会 第2日目会議録 [PDFファイル／600KB]</a></td>
        </tr>
      </table>
      <h2>令和6年9月定例会</h2>
      <table>
        <tr>
          <td>9月10日（火曜日）</td>
          <td><a href="/uploaded/attachment/333333.pdf">令和6年9月定例会 第1日目会議録 [PDFファイル／450KB]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.heldOn).toBe("2024-12-02");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.miyoshi.hiroshima.jp/uploaded/attachment/111111.pdf"
    );
    expect(meetings[0]!.section).toBe("令和6年12月定例会");

    expect(meetings[1]!.heldOn).toBe("2024-12-03");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.city.miyoshi.hiroshima.jp/uploaded/attachment/222222.pdf"
    );

    expect(meetings[2]!.heldOn).toBe("2024-09-10");
    expect(meetings[2]!.section).toBe("令和6年9月定例会");
  });

  it("臨時会も正しく抽出する", () => {
    const html = `
      <h2>令和6年第1回臨時会</h2>
      <table>
        <tr>
          <td>4月1日（月曜日）</td>
          <td><a href="/uploaded/attachment/444444.pdf">第1回臨時会会議録 [PDFファイル／200KB]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toContain("臨時会");
    expect(meetings[0]!.heldOn).toBe("2024-04-01");
  });

  it("定例会・臨時会の h2 見出しのないリンクはスキップする", () => {
    const html = `
      <h2>会議録について</h2>
      <table>
        <tr>
          <td>説明</td>
          <td><a href="/uploaded/attachment/555555.pdf">説明資料 [PDFファイル／100KB]</a></td>
        </tr>
      </table>
      <h2>令和6年12月定例会</h2>
      <table>
        <tr>
          <td>12月2日（月曜日）</td>
          <td><a href="/uploaded/attachment/111111.pdf">第1日目会議録 [PDFファイル／500KB]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("令和6年12月定例会");
  });

  it("月日が取得できない場合は YYYY-MM-01 をデフォルトとする", () => {
    const html = `
      <h2>令和6年12月定例会</h2>
      <table>
        <tr>
          <td>会議日程</td>
          <td><a href="/uploaded/attachment/111111.pdf">第1日目会議録 [PDFファイル／500KB]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
  });

  it("タイトルから PDFファイル情報を除去する", () => {
    const html = `
      <h2>令和6年12月定例会</h2>
      <table>
        <tr>
          <td>12月2日（月曜日）</td>
          <td><a href="/uploaded/attachment/111111.pdf">第1日目会議録 [PDFファイル／500KB]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings[0]!.title).not.toContain("[PDFファイル");
    expect(meetings[0]!.title).toContain("会議録");
  });
});
