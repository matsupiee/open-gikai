import { describe, it, expect } from "vitest";
import { parseListPage, parseDetailPage, parseDateFromPdfText } from "./list";

describe("parseListPage", () => {
  it("詳細ページのリンクを抽出する", () => {
    const html = `
      <html><body>
        <a href="/4387.htm">令和8年第1回日野町議会臨時会会議録</a>
        <a href="/4372.htm">令和7年第6回日野町議会定例会会議録</a>
        <a href="/3170.htm">令和元年第3回日野町議会臨時会会議録</a>
      </body></html>
    `;

    const pages = parseListPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和8年第1回日野町議会臨時会会議録");
    expect(pages[0]!.url).toBe("https://www.town.hino.tottori.jp/4387.htm");
    expect(pages[0]!.year).toBe(2026);

    expect(pages[1]!.label).toBe("令和7年第6回日野町議会定例会会議録");
    expect(pages[1]!.url).toBe("https://www.town.hino.tottori.jp/4372.htm");
    expect(pages[1]!.year).toBe(2025);

    expect(pages[2]!.label).toBe("令和元年第3回日野町議会臨時会会議録");
    expect(pages[2]!.url).toBe("https://www.town.hino.tottori.jp/3170.htm");
    expect(pages[2]!.year).toBe(2019);
  });

  it("日野町議会を含まないリンクはスキップする", () => {
    const html = `
      <html><body>
        <a href="/1234.htm">令和7年お知らせ</a>
        <a href="/4372.htm">令和7年第6回日野町議会定例会会議録</a>
      </body></html>
    `;

    const pages = parseListPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年第6回日野町議会定例会会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <html><body>
        <a href="/5555.htm">令和7年日野町議会だより</a>
      </body></html>
    `;

    const pages = parseListPage(html);
    expect(pages).toHaveLength(0);
  });
});

describe("parseDetailPage", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <html><body>
        <a href="/secure/12345/06R071205.pdf">第1日</a>
        <a href="/secure/12345/06R071208.pdf">第2日</a>
        <a href="/secure/12345/06R071210.pdf">第3日</a>
      </body></html>
    `;

    const meetings = parseDetailPage(
      html,
      "https://www.town.hino.tottori.jp/4372.htm",
      "令和7年第6回日野町議会定例会会議録",
    );

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.hino.tottori.jp/secure/12345/06R071205.pdf",
    );
    expect(meetings[0]!.title).toBe(
      "令和7年第6回日野町議会定例会会議録 第1日",
    );
    expect(meetings[1]!.title).toBe(
      "令和7年第6回日野町議会定例会会議録 第2日",
    );
    expect(meetings[2]!.title).toBe(
      "令和7年第6回日野町議会定例会会議録 第3日",
    );
  });

  it("PDF 以外のリンクはスキップする", () => {
    const html = `
      <html><body>
        <a href="/some-page.htm">関連情報</a>
        <a href="/secure/12345/06R071205.pdf">第1日</a>
      </body></html>
    `;

    const meetings = parseDetailPage(
      html,
      "https://www.town.hino.tottori.jp/4372.htm",
      "令和7年第6回日野町議会定例会会議録",
    );

    expect(meetings).toHaveLength(1);
  });

  it("相対パスの PDF リンクを正しく解決する", () => {
    const html = `
      <html><body>
        <a href="secure/12345/test.pdf">第1日</a>
      </body></html>
    `;

    const meetings = parseDetailPage(
      html,
      "https://www.town.hino.tottori.jp/4372.htm",
      "テスト会議録",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.hino.tottori.jp/secure/12345/test.pdf",
    );
  });
});

describe("parseDateFromPdfText", () => {
  it("令和の開催日を抽出する", () => {
    const text =
      "第１回 日野町議会臨時会会議録 （第１日）\n令和８年１月20日（火曜日）";
    expect(parseDateFromPdfText(text)).toBe("2026-01-20");
  });

  it("全角数字を含む日付を正しくパースする", () => {
    const text = "令和７年１２月５日（金曜日）";
    expect(parseDateFromPdfText(text)).toBe("2025-12-05");
  });

  it("令和元年をパースする", () => {
    const text = "令和元年９月10日（火曜日）";
    expect(parseDateFromPdfText(text)).toBe("2019-09-10");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromPdfText("議事日程")).toBeNull();
  });
});
