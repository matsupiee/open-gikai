import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("指定年の PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li>
            <a href="/uploaded/attachment/12345.pdf">
              令和8年第1回（3月）大島町議会定例会結果報告について [PDFファイル／291KB]
            </a>
          </li>
          <li>
            <a href="/uploaded/attachment/12300.pdf">
              令和8年第1回（1月）大島町議会臨時会結果報告について [PDFファイル／50KB]
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2026);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.oshima.tokyo.jp/uploaded/attachment/12345.pdf"
    );
    expect(meetings[0]!.title).toBe(
      "令和8年第1回（3月）大島町議会定例会結果報告について"
    );
    expect(meetings[0]!.year).toBe(2026);
    expect(meetings[0]!.month).toBe(3);
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.oshima.tokyo.jp/uploaded/attachment/12300.pdf"
    );
    expect(meetings[1]!.title).toBe(
      "令和8年第1回（1月）大島町議会臨時会結果報告について"
    );
    expect(meetings[1]!.year).toBe(2026);
    expect(meetings[1]!.month).toBe(1);
  });

  it("指定年以外のリンクはスキップする", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li>
            <a href="/uploaded/attachment/12345.pdf">
              令和8年第1回（3月）大島町議会定例会結果報告について [PDFファイル／291KB]
            </a>
          </li>
          <li>
            <a href="/uploaded/attachment/11000.pdf">
              令和7年第4回（12月）大島町議会定例会結果報告について [PDFファイル／200KB]
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2026);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2026);
  });

  it("平成年号のリンクを正しく解析する", () => {
    const html = `
      <html>
      <body>
        <li>
          <a href="/uploaded/attachment/1234.pdf">
            平成26年第1回（3月）大島町議会定例会結果報告について [PDFファイル／100KB]
          </a>
        </li>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2014);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2014);
    expect(meetings[0]!.month).toBe(3);
  });

  it("令和元年を正しく解析する", () => {
    const html = `
      <html>
      <body>
        <li>
          <a href="/uploaded/attachment/5678.pdf">
            令和元年第3回（9月）大島町議会定例会結果報告について [PDFファイル／150KB]
          </a>
        </li>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2019);
    expect(meetings[0]!.month).toBe(9);
  });

  it("開催月が不明の場合は month が null になる", () => {
    const html = `
      <html>
      <body>
        <li>
          <a href="/uploaded/attachment/9999.pdf">
            令和6年第2回大島町議会定例会結果報告について [PDFファイル／200KB]
          </a>
        </li>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.month).toBeNull();
  });

  it("同じ URL の重複を除外する", () => {
    const html = `
      <html>
      <body>
        <a href="/uploaded/attachment/12345.pdf">
          令和8年第1回（3月）大島町議会定例会結果報告について [PDFファイル／291KB]
        </a>
        <a href="/uploaded/attachment/12345.pdf">
          令和8年第1回（3月）大島町議会定例会結果報告について [PDFファイル／291KB]
        </a>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2026);
    expect(meetings).toHaveLength(1);
  });

  it("年号が解析できないリンクはスキップする", () => {
    const html = `
      <html>
      <body>
        <a href="/uploaded/attachment/12345.pdf">
          大島町議会定例会結果報告について [PDFファイル／291KB]
        </a>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("PDF URL 以外のリンクはスキップする", () => {
    const html = `
      <html>
      <body>
        <a href="/soshiki/gikaijim/gikai-kekka.html">一覧へ戻る</a>
        <a href="/uploaded/attachment/12345.pdf">
          令和6年第1回（3月）大島町議会定例会結果報告について [PDFファイル／200KB]
        </a>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(1);
  });

  it("リンクが0件の場合は空配列を返す", () => {
    const html = `<html><body><p>リンクなし</p></body></html>`;
    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });
});
