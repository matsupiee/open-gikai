import { describe, expect, it } from "vitest";
import { parsePageLinks } from "./list";

describe("parsePageLinks", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <html><body>
        <a href="/gikai/2024/a4545f7d6069d0b444451f796bfb8964.pdf">令和6年第2回定例会</a>
        <a href="/gikai/2025/8bfd5b1e0658744d7e26f37b168e6884.pdf">令和7年第1回定例会</a>
        <a href="/gikai/kaigiroku/R6/">令和6年</a>
      </body></html>
    `;

    const { pdfLinks, yearPageLinks } = parsePageLinks(
      html,
      "https://www.town.setana.lg.jp/gikai/kaigiroku/",
    );

    expect(pdfLinks).toHaveLength(2);
    expect(pdfLinks[0]!.url).toBe(
      "https://www.town.setana.lg.jp/gikai/2024/a4545f7d6069d0b444451f796bfb8964.pdf",
    );
    expect(pdfLinks[0]!.text).toBe("令和6年第2回定例会");
    expect(pdfLinks[1]!.url).toBe(
      "https://www.town.setana.lg.jp/gikai/2025/8bfd5b1e0658744d7e26f37b168e6884.pdf",
    );
    expect(yearPageLinks).toContain(
      "https://www.town.setana.lg.jp/gikai/kaigiroku/R6/",
    );
  });

  it("絶対 URL の PDF リンクも抽出する", () => {
    const html = `
      <a href="https://www.town.setana.lg.jp/gikai/9942fc9f65c79472fda6d56e08c22771.pdf">令和4年第3回定例会</a>
    `;

    const { pdfLinks } = parsePageLinks(
      html,
      "https://www.town.setana.lg.jp/gikai/kaigiroku/R4/",
    );

    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0]!.url).toBe(
      "https://www.town.setana.lg.jp/gikai/9942fc9f65c79472fda6d56e08c22771.pdf",
    );
  });

  it("PDF リンクが無い場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;

    const { pdfLinks } = parsePageLinks(
      html,
      "https://www.town.setana.lg.jp/gikai/kaigiroku/",
    );

    expect(pdfLinks).toHaveLength(0);
  });

  it("同じ URL の PDF リンクは重複除外される", () => {
    const html = `
      <a href="/gikai/test.pdf">定例会その1</a>
      <a href="/gikai/test.pdf">定例会その2（重複）</a>
    `;

    const { pdfLinks } = parsePageLinks(
      html,
      "https://www.town.setana.lg.jp/gikai/kaigiroku/",
    );

    expect(pdfLinks).toHaveLength(1);
  });

  it("外部サイトのリンクは年度ページリンクに含まれない", () => {
    const html = `
      <a href="https://example.com/other.html">外部リンク</a>
      <a href="/gikai/kaigiroku/R5/">令和5年</a>
    `;

    const { yearPageLinks } = parsePageLinks(
      html,
      "https://www.town.setana.lg.jp/gikai/kaigiroku/",
    );

    expect(yearPageLinks).toHaveLength(1);
    expect(yearPageLinks[0]).toBe(
      "https://www.town.setana.lg.jp/gikai/kaigiroku/R5/",
    );
  });

  it("uploads/documents 形式の PDF リンクも抽出する", () => {
    const html = `
      <a href="/uploads/documents/353569.pdf">平成28年第1回定例会</a>
    `;

    const { pdfLinks } = parsePageLinks(
      html,
      "https://www.town.setana.lg.jp/gikai/kaigiroku/h28kaigiroku/",
    );

    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0]!.url).toBe(
      "https://www.town.setana.lg.jp/uploads/documents/353569.pdf",
    );
  });
});
