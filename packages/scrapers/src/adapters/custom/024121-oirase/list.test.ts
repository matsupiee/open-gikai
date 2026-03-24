import { describe, expect, it } from "vitest";
import {
  parseIndexPage,
  parseYearPage,
  extractYearFromTitle,
  parseDateFromRow,
} from "./list";

describe("parseIndexPage", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <div class="list_ddd">
          <ul>
            <li>
              <span class="span_b">2026年2月3日更新</span>
              <span class="span_a"><a href="/site/gikai/kaigiroku2025.html">議会会議録の閲覧(令和７年)</a></span>
            </li>
            <li>
              <span class="span_b">2024年12月5日更新</span>
              <span class="span_a"><a href="/site/gikai/kaigiroku2024.html">議会会議録の閲覧(令和６年)</a></span>
            </li>
            <li>
              <span class="span_b">2023年12月5日更新</span>
              <span class="span_a"><a href="/site/gikai/kaigiroku2023.html">議会会議録の閲覧(令和５年)</a></span>
            </li>
          </ul>
        </div>
      </body>
      </html>
    `;

    const urls = parseIndexPage(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2025.html");
    expect(urls[1]).toBe("https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2024.html");
    expect(urls[2]).toBe("https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2023.html");
  });

  it("不規則なページスラグを含むリンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/12gatugikai.html">令和2年</a></li>
        <li><a href="/site/gikai/kaigiroku-31.html">平成31年・令和元年</a></li>
        <li><a href="/site/gikai/gikaikaigiroku.html">平成25年</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.town.oirase.aomori.jp/site/gikai/12gatugikai.html");
    expect(urls[1]).toBe("https://www.town.oirase.aomori.jp/site/gikai/kaigiroku-31.html");
    expect(urls[2]).toBe("https://www.town.oirase.aomori.jp/site/gikai/gikaikaigiroku.html");
  });

  it("list19-60.html 自体は除外する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list19-60.html">一覧ページ</a></li>
        <li><a href="/site/gikai/kaigiroku2024.html">令和6年</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2024.html");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/kaigiroku2024.html">令和6年</a></li>
        <li><a href="/site/gikai/kaigiroku2024.html">令和6年</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html);
    expect(urls).toHaveLength(1);
  });

  it("会議録リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const urls = parseIndexPage(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("定例会の PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和７年議会会議録</h2>
        <h3>第４回定例会（12月4日から12月10日まで）</h3>
        <table>
          <tbody>
            <tr>
              <td><strong>１２月　４日(木曜日)</strong></td>
              <td>本会議（開会）</td>
              <td><a href="/uploaded/attachment/26229.pdf">令和７年第４回定例会（第１号） [PDFファイル／373KB]</a></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2025.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("令和７年第４回定例会（第１号）");
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.oirase.aomori.jp/uploaded/attachment/26229.pdf",
    );
    expect(docs[0]!.pageUrl).toBe(pageUrl);
    expect(docs[0]!.rawDateText).toBe("１２月　４日(木曜日)");
  });

  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>第１回臨時会（５月２日）</h3>
        <table>
          <tbody>
            <tr>
              <td><strong>５月　２日(金曜日)</strong></td>
              <td>本会議（開会、議案審議、閉会）</td>
              <td><a href="/uploaded/attachment/25091.pdf">令和７年第１回臨時会（第１号） [PDFファイル／644KB]</a></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2025.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("令和７年第１回臨時会（第１号）");
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.oirase.aomori.jp/uploaded/attachment/25091.pdf",
    );
  });

  it("定例会に複数の PDF リンクがある場合をすべて抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>第１回定例会（3月5日から3月24日まで）</h3>
        <table>
          <tbody>
            <tr>
              <td><strong>３月　５日(火曜日)</strong></td>
              <td>本会議（開会）</td>
              <td><a href="/uploaded/attachment/100.pdf">令和７年第１回定例会（第１号） [PDFファイル／373KB]</a></td>
            </tr>
            <tr>
              <td><strong>３月　６日(水曜日)</strong></td>
              <td>本会議（一般質問）</td>
              <td><a href="/uploaded/attachment/101.pdf">令和７年第１回定例会（第２号） [PDFファイル／400KB]</a></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2025.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(2);
    expect(docs[0]!.title).toBe("令和７年第１回定例会（第１号）");
    expect(docs[1]!.title).toBe("令和７年第１回定例会（第２号）");
    expect(docs[0]!.rawDateText).toBe("３月　５日(火曜日)");
    expect(docs[1]!.rawDateText).toBe("３月　６日(水曜日)");
  });

  it("古い年度のページで th タグを使った形式に対応する", () => {
    const html = `
      <html>
      <body>
        <h3>平成25年第4回（12月）定例会</h3>
        <table>
          <tbody>
            <tr>
              <th>12月5日（木曜日）　</th>
              <td>定例会開会</td>
              <td><a href="/uploaded/attachment/816.pdf">平成25年第4回定例会（1日目）H25.12.05 [PDFファイル／390KB]</a></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.oirase.aomori.jp/site/gikai/gikaikaigiroku.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.oirase.aomori.jp/uploaded/attachment/816.pdf",
    );
    expect(docs[0]!.rawDateText).toBe("12月5日（木曜日）");
  });

  it("ul/li 形式の臨時会（テーブルなし）を抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>平成25年第2回臨時会</h3>
        <ul>
          <li><a href="/uploaded/attachment/752.pdf">平成25年第2回臨時会（H25.06.28） [PDFファイル／316KB]</a></li>
        </ul>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.oirase.aomori.jp/site/gikai/gikaikaigiroku.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.oirase.aomori.jp/uploaded/attachment/752.pdf",
    );
    expect(docs[0]!.title).toBe("平成25年第2回臨時会（H25.06.28）");
  });

  it("定例会・臨時会・特別委員会以外の h3 はスキップする", () => {
    const html = `
      <html>
      <body>
        <h3>関係ない見出し</h3>
        <table>
          <tr><td>日付</td><td>会議</td><td><a href="/uploaded/attachment/99.pdf">リンク</a></td></tr>
        </table>
        <h3>第４回定例会（12月4日から12月10日まで）</h3>
        <table>
          <tr>
            <td><strong>１２月　４日(木曜日)</strong></td>
            <td>本会議</td>
            <td><a href="/uploaded/attachment/26229.pdf">令和７年第４回定例会（第１号） [PDFファイル／373KB]</a></td>
          </tr>
        </table>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2025.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("令和７年第４回定例会（第１号）");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const pageUrl = "https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2025.html";
    const docs = parseYearPage(html, pageUrl);
    expect(docs).toHaveLength(0);
  });

  it("特別委員会の PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>予算特別委員会</h3>
        <table>
          <tr>
            <td><strong>３月　８日(金曜日)</strong></td>
            <td>予算特別委員会</td>
            <td><a href="/uploaded/attachment/200.pdf">令和７年予算特別委員会（第１号） [PDFファイル／500KB]</a></td>
          </tr>
        </table>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.oirase.aomori.jp/site/gikai/kaigiroku2025.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("令和７年予算特別委員会（第１号）");
  });
});

describe("extractYearFromTitle", () => {
  it("令和7年を2025に変換する", () => {
    expect(extractYearFromTitle("令和７年第４回定例会（第１号）")).toBe(2025);
  });

  it("令和元年を2019に変換する", () => {
    expect(extractYearFromTitle("令和元年第１回定例会（第１号）")).toBe(2019);
  });

  it("平成25年を2013に変換する", () => {
    expect(extractYearFromTitle("平成25年第4回定例会（1日目）")).toBe(2013);
  });

  it("年号が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("第4回定例会")).toBeNull();
  });
});

describe("parseDateFromRow", () => {
  it("全角数字の日付を変換する（１２月　４日形式）", () => {
    expect(parseDateFromRow("１２月　４日(木曜日)", 2025)).toBe("2025-12-04");
  });

  it("半角数字の日付を変換する（12月5日形式）", () => {
    expect(parseDateFromRow("12月5日（木曜日）", 2025)).toBe("2025-12-05");
  });

  it("全角スペースを含む日付を変換する（３月　５日形式）", () => {
    expect(parseDateFromRow("３月　５日(火曜日)", 2025)).toBe("2025-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromRow("テキストなし", 2025)).toBeNull();
  });

  it("空文字列の場合は null を返す", () => {
    expect(parseDateFromRow("", 2025)).toBeNull();
  });
});
