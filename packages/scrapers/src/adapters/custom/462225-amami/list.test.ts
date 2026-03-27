import { describe, expect, it } from "vitest";
import { DEFAULT_LIST_URL, extractWesternYear } from "./shared";
import { cleanTitle, parseDetailPage, parseListPage } from "./list";

describe("extractWesternYear", () => {
  it("令和元年(平成31年) を 2019 に変換する", () => {
    expect(extractWesternYear("令和元年(平成31年)")).toBe(2019);
  });

  it("平成30年 を 2018 に変換する", () => {
    expect(extractWesternYear("平成30年")).toBe(2018);
  });
});

describe("cleanTitle", () => {
  it("PDF サイズ表記と分割注記を除去する", () => {
    expect(cleanTitle("令和2年第2回定例会（8つのファイルに分割されております）")).toBe(
      "令和2年第2回定例会",
    );
    expect(cleanTitle("令和7年第1回定例会（PDF：5,404KB）")).toBe("令和7年第1回定例会");
  });
});

describe("parseListPage", () => {
  it("通常 PDF と詳細 HTML リンクを年度別に抽出する", () => {
    const html = `
      <h2>令和7年</h2>
      <ul>
        <li><a href="/gikai/shise/shigikai/documents/kaigiroku_r7_1teirei.pdf">令和7年第1回定例会（PDF：5,404KB）</a></li>
      </ul>
      <h2>令和2年</h2>
      <ul>
        <li><a href="/gikai/2020_2nd_kaigiroku.html">令和2年第2回定例会（8つのファイルに分割されております）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, DEFAULT_LIST_URL);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]).toEqual({
      title: "令和7年第1回定例会",
      year: 2025,
      pdfUrls: [
        "https://www.city.amami.lg.jp/gikai/shise/shigikai/documents/kaigiroku_r7_1teirei.pdf",
      ],
      detailPageUrl: null,
    });
    expect(meetings[1]).toEqual({
      title: "令和2年第2回定例会",
      year: 2020,
      pdfUrls: [],
      detailPageUrl: "https://www.city.amami.lg.jp/gikai/2020_2nd_kaigiroku.html",
    });
  });

  it("平成22年の分割 PDF を 1 会議として束ねる", () => {
    const html = `
      <h2>平成22年</h2>
      <ul>
        <li>
          平成22年第1回定例会<br />
          <a href="/gikai/shise/shigikai/documents/h22teirei1-1.pdf">平成22年第1回定例会（1）（PDF：7,405KB）</a><br />
          <a href="/gikai/shise/shigikai/documents/h22teirei1-2.pdf">平成22年第1回定例会（2）（PDF：6,063KB）</a>
        </li>
      </ul>
    `;

    const meetings = parseListPage(html, DEFAULT_LIST_URL, 2010);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]).toEqual({
      title: "平成22年第1回定例会",
      year: 2010,
      pdfUrls: [
        "https://www.city.amami.lg.jp/gikai/shise/shigikai/documents/h22teirei1-1.pdf",
        "https://www.city.amami.lg.jp/gikai/shise/shigikai/documents/h22teirei1-2.pdf",
      ],
      detailPageUrl: null,
    });
  });
});

describe("parseDetailPage", () => {
  it("分割詳細ページから PDF リンクだけを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gikai/documents/r2-2-1.pdf">表紙、日程、議決事件、一般質問通告（PDF：1,304KB）</a></li>
        <li><a href="/gikai/documents/r2-2-2.pdf">第1日目（PDF：2,885KB）</a></li>
        <li><a href="/gikai/documents/r2-2-3.pdf">第2日目（PDF：7,567KB）</a></li>
      </ul>
      <p><a href="https://get.adobe.com/jp/reader/">Adobe Reader</a></p>
    `;

    expect(
      parseDetailPage(html, "https://www.city.amami.lg.jp/gikai/2020_2nd_kaigiroku.html"),
    ).toEqual([
      "https://www.city.amami.lg.jp/gikai/documents/r2-2-1.pdf",
      "https://www.city.amami.lg.jp/gikai/documents/r2-2-2.pdf",
      "https://www.city.amami.lg.jp/gikai/documents/r2-2-3.pdf",
    ]);
  });
});
