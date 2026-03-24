import { describe, expect, it } from "vitest";
import {
  parseListPage,
  parseYearPage,
  extractYearFromPageHtml,
  parseDateFromPdfText,
} from "./list";

describe("parseListPage", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <html><body>
      <ul>
        <li><a href="/site/gikai/50370.html">令和7年</a></li>
        <li><a href="/site/gikai/45944.html">令和6年</a></li>
        <li><a href="/site/gikai/41947.html">令和5年</a></li>
      </ul>
      </body></html>
    `;

    const urls = parseListPage(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.town.tobetsu.hokkaido.jp/site/gikai/50370.html");
    expect(urls[1]).toBe("https://www.town.tobetsu.hokkaido.jp/site/gikai/45944.html");
    expect(urls[2]).toBe("https://www.town.tobetsu.hokkaido.jp/site/gikai/41947.html");
  });

  it("一覧ページ自身（18717）はスキップする", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/18717.html">会議録一覧</a></li>
        <li><a href="/site/gikai/50370.html">令和7年</a></li>
      </ul>
    `;

    const urls = parseListPage(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.tobetsu.hokkaido.jp/site/gikai/50370.html");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <a href="/site/gikai/45944.html">令和6年</a>
      <a href="/site/gikai/45944.html">令和6年（再掲）</a>
    `;

    const urls = parseListPage(html);
    expect(urls).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const urls = parseListPage(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("定例会の PDF リンクを抽出する", () => {
    const html = `
      <html><body>
      <h2>令和6年議会</h2>
      <ul>
        <li><a href="/uploaded/attachment/12345.pdf">令和6年第1回定例会（3月）[PDFファイル/154KB]</a></li>
        <li><a href="/uploaded/attachment/12346.pdf">令和6年第2回定例会（6月）[PDFファイル/200KB]</a></li>
      </ul>
      </body></html>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.tobetsu.hokkaido.jp/uploaded/attachment/12345.pdf",
    );
    expect(meetings[0]!.pdfKey).toBe("013030_12345");
    expect(meetings[0]!.category).toBe("plenary");
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.title).toContain("定例会");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.tobetsu.hokkaido.jp/uploaded/attachment/12346.pdf",
    );
    expect(meetings[1]!.pdfKey).toBe("013030_12346");
    expect(meetings[1]!.category).toBe("plenary");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <ul>
        <li><a href="/uploaded/attachment/99999.pdf">令和6年第1回臨時会[PDFファイル/100KB]</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("extraordinary");
  });

  it("リンクテキストに年度が含まれる場合は年度を解析する", () => {
    const html = `
      <ul>
        <li><a href="/uploaded/attachment/11111.pdf">令和5年第1回定例会（3月）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2023);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/other.html">別のリンク</a></li>
      </ul>
    `;
    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });
});

describe("extractYearFromPageHtml", () => {
  it("令和年度を西暦に変換する", () => {
    const html = `<html><head><title>令和6年議会会議録</title></head></html>`;
    expect(extractYearFromPageHtml(html)).toBe(2024);
  });

  it("平成年度を西暦に変換する", () => {
    const html = `<html><head><title>平成30年議会会議録</title></head></html>`;
    expect(extractYearFromPageHtml(html)).toBe(2018);
  });

  it("全角数字の年度を変換する", () => {
    const html = `<h2>令和６年</h2>`;
    expect(extractYearFromPageHtml(html)).toBe(2024);
  });

  it("年度情報がない場合は 0 を返す", () => {
    const html = `<html><body><p>内容なし</p></body></html>`;
    expect(extractYearFromPageHtml(html)).toBe(0);
  });
});

describe("parseDateFromPdfText", () => {
  it("令和の年月日（半角）をパースする", () => {
    expect(parseDateFromPdfText("令和6年3月4日（月曜日）")).toBe("2024-03-04");
  });

  it("令和の年月日（全角数字）をパースする", () => {
    expect(parseDateFromPdfText("令和６年３月４日（月曜日）")).toBe("2024-03-04");
  });

  it("令和元年をパースする", () => {
    expect(parseDateFromPdfText("令和元年6月3日")).toBe("2019-06-03");
  });

  it("平成の年月日をパースする", () => {
    expect(parseDateFromPdfText("平成25年3月5日")).toBe("2013-03-05");
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(parseDateFromPdfText("当別町議会定例会会議録")).toBeNull();
  });
});
