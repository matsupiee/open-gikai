import { describe, expect, it } from "vitest";
import { parseMeetingYearMonth, parseListPage } from "./list";

describe("parseMeetingYearMonth", () => {
  it("令和年月を西暦に変換する", () => {
    const result = parseMeetingYearMonth(
      "いかわ町議会だより（令和7年6月議会）",
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.month).toBe(6);
  });

  it("令和元年を正しく変換する", () => {
    const result = parseMeetingYearMonth(
      "いかわ町議会だより（令和元年12月議会）",
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
    expect(result!.month).toBe(12);
  });

  it("平成年月を西暦に変換する", () => {
    const result = parseMeetingYearMonth(
      "いかわ町議会だより（平成28年3月議会）",
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2016);
    expect(result!.month).toBe(3);
  });

  it("年月が含まれないテキストは null を返す", () => {
    const result = parseMeetingYearMonth("お知らせ");
    expect(result).toBeNull();
  });

  it("令和6年12月議会を変換する", () => {
    const result = parseMeetingYearMonth(
      "いかわ町議会だより（令和6年12月議会）",
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.month).toBe(12);
  });
});

describe("parseListPage", () => {
  it("PDF リンクとタイトルを抽出する", () => {
    const html = `
      <html><body>
        <ul>
          <li>
            <a href="/uploaded/attachment/12345.pdf">いかわ町議会だより（令和7年6月議会）</a>
          </li>
          <li>
            <a href="/uploaded/attachment/12200.pdf">いかわ町議会だより（令和7年3月議会）</a>
          </li>
          <li>
            <a href="/uploaded/attachment/11800.pdf">いかわ町議会だより（令和6年12月議会）</a>
          </li>
        </ul>
      </body></html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ikawa.akita.jp/uploaded/attachment/12345.pdf",
    );
    expect(meetings[0]!.title).toBe("いかわ町議会だより（令和7年6月議会）");
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.month).toBe(6);

    expect(meetings[1]!.year).toBe(2025);
    expect(meetings[1]!.month).toBe(3);

    expect(meetings[2]!.year).toBe(2024);
    expect(meetings[2]!.month).toBe(12);
  });

  it("年月が解析できないリンクはスキップする", () => {
    const html = `
      <html><body>
        <a href="/uploaded/attachment/99999.pdf">議会関連ドキュメント</a>
        <a href="/uploaded/attachment/12345.pdf">いかわ町議会だより（令和7年6月議会）</a>
      </body></html>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.month).toBe(6);
  });

  it("/uploaded/attachment/ 以外の PDF リンクはスキップする", () => {
    const html = `
      <html><body>
        <a href="/other/path/doc.pdf">いかわ町議会だより（令和7年6月議会）</a>
        <a href="/uploaded/attachment/12345.pdf">いかわ町議会だより（令和7年3月議会）</a>
      </body></html>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.month).toBe(3);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("絶対 URL はそのまま保持する", () => {
    const html = `
      <a href="https://www.town.ikawa.akita.jp/uploaded/attachment/12345.pdf">いかわ町議会だより（令和7年6月議会）</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ikawa.akita.jp/uploaded/attachment/12345.pdf",
    );
  });
});
