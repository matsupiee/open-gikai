import { describe, expect, it } from "vitest";
import {
  parseTopPage,
  parseYearPage,
  parseMeetingPage,
  categoryFromPageUrl,
} from "./list";

describe("parseTopPage", () => {
  it("年度別リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/gikai/kaigiroku/R7/">令和7年</a></li>
          <li><a href="/gikai/kaigiroku/R6/">令和6年</a></li>
          <li><a href="/gikai/kaigiroku/R5/">令和5年</a></li>
          <li><a href="/gikai/kaigiroku/H31/">平成31年</a></li>
          <li><a href="/gikai/kaigiroku/H30/">平成30年</a></li>
        </ul>
      </body>
      </html>
    `;

    const entries = parseTopPage(html);

    expect(entries).toHaveLength(5);
    expect(entries[0]!.eraCode).toBe("R7");
    expect(entries[0]!.year).toBe(2025);
    expect(entries[1]!.eraCode).toBe("R6");
    expect(entries[1]!.year).toBe(2024);
    expect(entries[2]!.eraCode).toBe("R5");
    expect(entries[2]!.year).toBe(2023);
    expect(entries[3]!.eraCode).toBe("H31");
    expect(entries[3]!.year).toBe(2019);
    expect(entries[4]!.eraCode).toBe("H30");
    expect(entries[4]!.year).toBe(2018);
  });

  it("重複する年号コードは1件に絞る", () => {
    const html = `
      <a href="/gikai/kaigiroku/R6/">令和6年</a>
      <a href="/gikai/kaigiroku/R6/">令和6年（再掲）</a>
    `;

    const entries = parseTopPage(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.eraCode).toBe("R6");
  });

  it("リンクが存在しない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;

    const entries = parseTopPage(html);
    expect(entries).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("会議種別ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/gikai/kaigiroku/R6/teireikai.html">議会定例会</a></li>
          <li><a href="/gikai/kaigiroku/R6/rinji.html">議会臨時会</a></li>
          <li><a href="/gikai/kaigiroku/R6/soumu.html">常任委員会</a></li>
          <li><a href="/gikai/kaigiroku/R6/yosan.html">予算等審査特別委員会</a></li>
          <li><a href="/gikai/kaigiroku/R6/kessan.html">決算審査特別委員会</a></li>
        </ul>
      </body>
      </html>
    `;

    const yearPageUrl = "https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/";
    const urls = parseYearPage(html, yearPageUrl);

    expect(urls).toHaveLength(5);
    expect(urls[0]).toBe("https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/teireikai.html");
    expect(urls[1]).toBe("https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/rinji.html");
    expect(urls[2]).toBe("https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/soumu.html");
  });

  it("他の年度のリンクは含まない", () => {
    const html = `
      <a href="/gikai/kaigiroku/R6/teireikai.html">R6定例会</a>
      <a href="/gikai/kaigiroku/R5/teireikai.html">R5定例会</a>
    `;

    const yearPageUrl = "https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/";
    const urls = parseYearPage(html, yearPageUrl);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/R6/");
  });

  it("重複 URL は1件に絞る", () => {
    const html = `
      <a href="/gikai/kaigiroku/R6/teireikai.html">定例会</a>
      <a href="/gikai/kaigiroku/R6/teireikai.html">定例会（再掲）</a>
    `;

    const yearPageUrl = "https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/";
    const urls = parseYearPage(html, yearPageUrl);

    expect(urls).toHaveLength(1);
  });
});

describe("parseMeetingPage", () => {
  it("PDF リンクと開催日を抽出する", () => {
    const html = `
      <html>
      <body>
        <p>令和6年3月4日～3月11日</p>
        <a href="/files/00005200/00005207/第1回定例会.pdf">第1回定例会</a>
        <p>令和6年6月20日</p>
        <a href="/files/00005200/00005207/第2回定例会.pdf">第2回定例会</a>
      </body>
      </html>
    `;

    const pageUrl = "https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/teireikai.html";
    const items = parseMeetingPage(html, pageUrl);

    expect(items).toHaveLength(2);
    expect(items[0]!.pdfUrl).toBe(
      "https://www.town.kikonai.hokkaido.jp/files/00005200/00005207/第1回定例会.pdf",
    );
    expect(items[0]!.title).toBe("第1回定例会");
    expect(items[0]!.heldOn).toBe("2024-03-04");
    expect(items[1]!.title).toBe("第2回定例会");
    expect(items[1]!.heldOn).toBe("2024-06-20");
  });

  it("開催日が見つからない場合は null を返す", () => {
    const html = `
      <a href="/files/00005200/00005207/第1回定例会.pdf">第1回定例会</a>
    `;

    const pageUrl = "https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/teireikai.html";
    const items = parseMeetingPage(html, pageUrl);

    expect(items).toHaveLength(1);
    expect(items[0]!.heldOn).toBeNull();
  });

  it("PDF が存在しない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録 PDF はありません</p></body></html>`;

    const pageUrl = "https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/teireikai.html";
    const items = parseMeetingPage(html, pageUrl);

    expect(items).toHaveLength(0);
  });

  it("臨時会の PDF を抽出する", () => {
    const html = `
      <p>令和6年1月15日</p>
      <a href="/files/00005200/00005204/R6.1（臨時会）.pdf">R6.1（臨時会）</a>
      <p>令和6年9月10日</p>
      <a href="/files/00005200/00005204/R6.2（臨時会）.pdf">R6.2（臨時会）</a>
    `;

    const pageUrl = "https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/R6/rinji.html";
    const items = parseMeetingPage(html, pageUrl);

    expect(items).toHaveLength(2);
    expect(items[0]!.heldOn).toBe("2024-01-15");
    expect(items[1]!.heldOn).toBe("2024-09-10");
  });
});

describe("categoryFromPageUrl", () => {
  it("teireikai.html を定例会として判定する", () => {
    expect(categoryFromPageUrl("https://example.com/R6/teireikai.html")).toBe("定例会");
  });

  it("reireikai.html を定例会として判定する", () => {
    expect(categoryFromPageUrl("https://example.com/R6/reireikai.html")).toBe("定例会");
  });

  it("rinji.html を臨時会として判定する", () => {
    expect(categoryFromPageUrl("https://example.com/R6/rinji.html")).toBe("臨時会");
  });

  it("rinzi.html を臨時会として判定する", () => {
    expect(categoryFromPageUrl("https://example.com/R6/rinzi.html")).toBe("臨時会");
  });

  it("soumu.html を常任委員会として判定する", () => {
    expect(categoryFromPageUrl("https://example.com/R6/soumu.html")).toBe("常任委員会");
  });

  it("yosan.html を予算等審査特別委員会として判定する", () => {
    expect(categoryFromPageUrl("https://example.com/R6/yosan.html")).toBe("予算等審査特別委員会");
  });

  it("kessan.html を決算審査特別委員会として判定する", () => {
    expect(categoryFromPageUrl("https://example.com/R6/kessan30.html")).toBe("決算審査特別委員会");
  });

  it("不明なパターンは「会議」を返す", () => {
    expect(categoryFromPageUrl("https://example.com/R6/unknown.html")).toBe("会議");
  });
});
