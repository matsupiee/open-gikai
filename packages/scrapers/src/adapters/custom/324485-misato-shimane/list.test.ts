import { describe, expect, it } from "vitest";
import {
  parseAbbreviatedDate,
  parseTopPage,
  parseListPage,
} from "./list";

describe("parseAbbreviatedDate", () => {
  it("令和の略記日付をパースする（R7.12.9）", () => {
    expect(parseAbbreviatedDate("R7.12.9")).toBe("2025-12-09");
  });

  it("令和の略記日付をパースする（R6.11.29）", () => {
    expect(parseAbbreviatedDate("R6.11.29")).toBe("2024-11-29");
  });

  it("令和の略記日付をパースする（R6.4.23）", () => {
    expect(parseAbbreviatedDate("R6.4.23")).toBe("2024-04-23");
  });

  it("令和元年に相当する R1 をパースする", () => {
    expect(parseAbbreviatedDate("R1.6.3")).toBe("2019-06-03");
  });

  it("平成の略記日付をパースする（H26.3.5）", () => {
    expect(parseAbbreviatedDate("H26.3.5")).toBe("2014-03-05");
  });

  it("全角数字を含む日付をパースする", () => {
    expect(parseAbbreviatedDate("R７.１２.９")).toBe("2025-12-09");
  });

  it("不正なフォーマットは null を返す", () => {
    expect(parseAbbreviatedDate("2024-01-01")).toBeNull();
  });

  it("空文字列は null を返す", () => {
    expect(parseAbbreviatedDate("")).toBeNull();
  });
});

describe("parseTopPage", () => {
  it("年別ページへのリンクを抽出する", () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="/gikai/1910/6161">令和6年</a></li>
          <li><a href="/gikai/1910/4845">令和5年</a></li>
          <li><a href="/gikai/1910/3257">令和4年</a></li>
        </ul>
      </body></html>
    `;

    const urls = parseTopPage(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://gov.town.shimane-misato.lg.jp/gikai/1910/6161");
    expect(urls[1]).toBe("https://gov.town.shimane-misato.lg.jp/gikai/1910/4845");
    expect(urls[2]).toBe("https://gov.town.shimane-misato.lg.jp/gikai/1910/3257");
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/gikai/1910/6161">令和6年</a>
      <a href="/gikai/1910/6161">令和6年（重複）</a>
    `;

    const urls = parseTopPage(html);
    expect(urls).toHaveLength(1);
  });

  it("年別ページ以外のリンクは無視する", () => {
    const html = `
      <a href="/gikai/1910/">トップ</a>
      <a href="/gikai/1910/6161">令和6年</a>
      <a href="/about/">概要</a>
    `;

    const urls = parseTopPage(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://gov.town.shimane-misato.lg.jp/gikai/1910/6161");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>リンクなし</p></body></html>`;
    const urls = parseTopPage(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseListPage", () => {
  it("定例会の PDF エントリを抽出する", () => {
    const html = `
      <html><body>
        <h2>令和6年</h2>
        <h3>第4回定例会（1日目）R6.11.29議事録
          <a href="/files/original/20241201120000abcdef.pdf">PDF</a>
        </h3>
        <h3>第1回定例会（5日目）R6.3.13議事録
          <a href="/files/original/20240315090000123456.pdf">PDF</a>
        </h3>
      </body></html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://gov.town.shimane-misato.lg.jp/files/original/20241201120000abcdef.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-11-29");
    expect(meetings[0]!.category).toBe("plenary");
    expect(meetings[0]!.pdfKey).toBe("324485_20241201120000abcdef");
    expect(meetings[0]!.title).toContain("第4回定例会");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://gov.town.shimane-misato.lg.jp/files/original/20240315090000123456.pdf",
    );
    expect(meetings[1]!.heldOn).toBe("2024-03-13");
    expect(meetings[1]!.category).toBe("plenary");
  });

  it("臨時会の category を correctly 設定する", () => {
    const html = `
      <h3>第２回臨時会 R6.4.23議事録
        <a href="/files/original/20240425100000abc123.pdf">PDF</a>
      </h3>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("extraordinary");
    expect(meetings[0]!.heldOn).toBe("2024-04-23");
  });

  it("PDF リンクのない h3 はスキップする", () => {
    const html = `
      <h3>令和6年度の会議録一覧</h3>
      <h3>第4回定例会（1日目）R6.11.29議事録
        <a href="/files/original/20241201120000abcdef.pdf">PDF</a>
      </h3>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("全角数字の日付を正しく解析する", () => {
    const html = `
      <h3>第４回定例会（４日目）R７.１２.９議事録
        <a href="/files/original/20251210090000abc999.pdf">PDF</a>
      </h3>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-12-09");
  });

  it("平成年の日付を正しく解析する", () => {
    const html = `
      <h3>第1回定例会 H26.3.5議事録
        <a href="/files/original/20140307100000xyz.pdf">PDF</a>
      </h3>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2014-03-05");
  });

  it("h3 がない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録なし</p></body></html>`;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});
