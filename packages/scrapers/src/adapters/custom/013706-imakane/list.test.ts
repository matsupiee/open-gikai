import { describe, expect, it } from "vitest";
import { parsePageLinks } from "./list";

describe("parsePageLinks", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <html><body>
        <a href="/ass/21a697f62d54c8acdf12c7514080ac70.pdf">令和7年第2回定例会</a>
        <a href="/ass/1cf31664e7b8be429bc93e6d846d5a0a.pdf">令和7年第1回定例会 第3号</a>
        <a href="/ass/cat/post_15.html">合同委員会</a>
      </body></html>
    `;

    const { pdfLinks, categoryLinks } = parsePageLinks(
      html,
      "https://www.town.imakane.lg.jp/ass/kaigiroku/",
    );

    expect(pdfLinks).toHaveLength(2);
    expect(pdfLinks[0]!.url).toBe(
      "https://www.town.imakane.lg.jp/ass/21a697f62d54c8acdf12c7514080ac70.pdf",
    );
    expect(pdfLinks[0]!.text).toBe("令和7年第2回定例会");
    expect(pdfLinks[1]!.url).toBe(
      "https://www.town.imakane.lg.jp/ass/1cf31664e7b8be429bc93e6d846d5a0a.pdf",
    );
    expect(categoryLinks).toContain(
      "https://www.town.imakane.lg.jp/ass/cat/post_15.html",
    );
  });

  it("絶対 URL の PDF リンクも抽出する", () => {
    const html = `
      <a href="https://www.town.imakane.lg.jp/ass/uploads/pdf/H27.8.21ー本文.pdf">平成27年第5回臨時会</a>
    `;

    const { pdfLinks } = parsePageLinks(
      html,
      "https://www.town.imakane.lg.jp/ass/kaigiroku/",
    );

    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0]!.url).toBe(
      "https://www.town.imakane.lg.jp/ass/uploads/pdf/H27.8.21ー本文.pdf",
    );
  });

  it("PDF リンクが無い場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;

    const { pdfLinks } = parsePageLinks(
      html,
      "https://www.town.imakane.lg.jp/ass/kaigiroku/",
    );

    expect(pdfLinks).toHaveLength(0);
  });

  it("同じ URL の PDF リンクは重複除外される", () => {
    const html = `
      <a href="/ass/test.pdf">定例会その1</a>
      <a href="/ass/test.pdf">定例会その2（重複）</a>
    `;

    const { pdfLinks } = parsePageLinks(
      html,
      "https://www.town.imakane.lg.jp/ass/kaigiroku/",
    );

    expect(pdfLinks).toHaveLength(1);
  });

  it("相対パス（../）を含む PDF リンクは正しく解決される", () => {
    const html = `
      <a href="../dayori/../test.pdf">議会だより</a>
    `;

    const { pdfLinks } = parsePageLinks(
      html,
      "https://www.town.imakane.lg.jp/ass/kaigiroku/",
    );

    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0]!.url).toBe(
      "https://www.town.imakane.lg.jp/ass/test.pdf",
    );
  });

  it("dayori（議会だより）のカテゴリリンクは除外される", () => {
    const html = `
      <a href="/ass/dayori/index.html">議会だより</a>
      <a href="/ass/cat/post_15.html">合同委員会</a>
    `;

    const { categoryLinks } = parsePageLinks(
      html,
      "https://www.town.imakane.lg.jp/ass/kaigiroku/",
    );

    expect(categoryLinks).toHaveLength(1);
    expect(categoryLinks[0]).toBe(
      "https://www.town.imakane.lg.jp/ass/cat/post_15.html",
    );
  });

  it("外部サイトのリンクはカテゴリリンクに含まれない", () => {
    const html = `
      <a href="https://example.com/other.html">外部リンク</a>
      <a href="/ass/cat/post_15.html">合同委員会</a>
    `;

    const { categoryLinks } = parsePageLinks(
      html,
      "https://www.town.imakane.lg.jp/ass/kaigiroku/",
    );

    expect(categoryLinks).toHaveLength(1);
    expect(categoryLinks[0]).toBe(
      "https://www.town.imakane.lg.jp/ass/cat/post_15.html",
    );
  });
});
