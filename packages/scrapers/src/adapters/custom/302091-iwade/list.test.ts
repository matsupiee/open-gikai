import { describe, expect, it } from "vitest";
import { parseMainPage, parseYearListPage, parseSessionPage, estimateYear } from "./list";

describe("parseMainPage", () => {
  it("令和X年会議録のリンクのみを抽出し年を解析する", () => {
    const html = `
      <html><body>
        <h2>会議録（本会議）</h2>
        <ul>
          <li><a href="/site/gikai/list12-53.html">令和7年会議録（本会議）</a></li>
          <li><a href="/site/gikai/list12-54.html">令和6年会議録（本会議）</a></li>
          <li><a href="/site/gikai/list12-57.html">令和3年会議録（本会議）</a></li>
        </ul>
        <p><a href="/site/gikai/list12.html">会議録（本会議）の一覧</a></p>
        <a href="/site/gikai/1157.html">会議日程</a>
      </body></html>
    `;

    const links = parseMainPage(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.href).toBe("/site/gikai/list12-53.html");
    expect(links[0]!.text).toBe("令和7年会議録（本会議）");
    expect(links[0]!.year).toBe(2025);
    expect(links[1]!.year).toBe(2024);
    expect(links[2]!.href).toBe("/site/gikai/list12-57.html");
    expect(links[2]!.year).toBe(2021);
  });

  it("令和元年は 2019 として解析する", () => {
    const html = `
      <html><body>
        <a href="/site/gikai/list12-99.html">令和元年会議録（本会議）</a>
      </body></html>
    `;

    const links = parseMainPage(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.year).toBe(2019);
  });

  it("令和X年会議録以外のリンクはスキップする", () => {
    const html = `
      <html><body>
        <a href="/site/gikai/list12.html">会議録（本会議）の一覧</a>
        <a href="/site/gikai/1157.html">会議日程</a>
      </body></html>
    `;

    const links = parseMainPage(html);
    expect(links).toHaveLength(0);
  });
});

describe("parseYearListPage", () => {
  it("数字のみのファイル名（定例会ページ）のリンクを抽出する", () => {
    const html = `
      <html><body>
        <h2>令和3年会議録（本会議）</h2>
        <ul>
          <li><a href="/site/gikai/1138.html">令和3年第4回定例会（12月議会）</a></li>
          <li><a href="/site/gikai/1140.html">令和3年第2回臨時会</a></li>
          <li><a href="/site/gikai/1135.html">令和3年第1回定例会（3月議会）</a></li>
        </ul>
        <a href="/site/gikai/list12-57.html">令和3年会議録一覧へ戻る</a>
      </body></html>
    `;

    const links = parseYearListPage(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.href).toBe("/site/gikai/1138.html");
    expect(links[0]!.text).toBe("令和3年第4回定例会（12月議会）");
    expect(links[1]!.href).toBe("/site/gikai/1140.html");
    expect(links[2]!.href).toBe("/site/gikai/1135.html");
  });

  it("リストページ形式（list12-xx.html）のリンクはスキップする", () => {
    const html = `
      <html><body>
        <a href="/site/gikai/list12-57.html">令和3年会議録</a>
        <a href="/site/gikai/1138.html">令和3年第4回定例会</a>
      </body></html>
    `;

    const links = parseYearListPage(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.href).toBe("/site/gikai/1138.html");
  });

  it("リンクが0件の場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;
    const links = parseYearListPage(html);
    expect(links).toHaveLength(0);
  });
});

describe("parseSessionPage", () => {
  it("「全体分」を含む PDF リンクを返す", () => {
    const html = `
      <html><body>
        <h2>会議録（全体分）</h2>
        <p><a href="files/R7-1zzentai.2.pdf">会議録（全体分）</a></p>
        <h3>会議録（各日程ごと）</h3>
        <p><a href="files/R7-1-1R070228.pdf">第1日（2月28日）</a></p>
        <p><a href="files/R7-1-2R070306.2.pdf">第2日（3月6日）</a></p>
      </body></html>
    `;

    const pdfHref = parseSessionPage(html);
    expect(pdfHref).toBe("files/R7-1zzentai.2.pdf");
  });

  it("全体版がない場合は null を返す", () => {
    const html = `
      <html><body>
        <a href="files/R7-1-1R070228.pdf">第1日（2月28日）</a>
        <a href="files/R7-1-2R070306.2.pdf">第2日（3月6日）</a>
      </body></html>
    `;

    const pdfHref = parseSessionPage(html);
    expect(pdfHref).toBeNull();
  });

  it("「全体」を含む PDF リンクも対象とする", () => {
    const html = `
      <html><body>
        <a href="files/R6-4zentai.pdf">会議録（全体）</a>
      </body></html>
    `;

    const pdfHref = parseSessionPage(html);
    expect(pdfHref).toBe("files/R6-4zentai.pdf");
  });
});

describe("estimateYear", () => {
  it("令和7年 → 2025", () => {
    expect(estimateYear("令和7年第1回定例会（3月議会）", "R7-1.html")).toBe(2025);
  });

  it("令和元年 → 2019", () => {
    expect(estimateYear("令和元年第1回定例会", "R1-1.html")).toBe(2019);
  });

  it("令和6年 → 2024", () => {
    expect(estimateYear("令和6年第1回定例会（3月議会）", "2024-0612-R6-1.html")).toBe(2024);
  });

  it("平成31年 → 2019", () => {
    expect(estimateYear("平成31年第1回定例会", "2019-0301-H31-1.html")).toBe(2019);
  });

  it("href の年プレフィックスから推定する（テキストに年号なし）", () => {
    expect(estimateYear("第4回定例会（12月）", "2025-0306-1950-77.html")).toBe(2025);
  });

  it("href の令和番号から推定する", () => {
    expect(estimateYear("定例会", "R7-3.html")).toBe(2025);
  });

  it("推定不可の場合は null", () => {
    expect(estimateYear("会議録", "unknown.html")).toBeNull();
  });
});
