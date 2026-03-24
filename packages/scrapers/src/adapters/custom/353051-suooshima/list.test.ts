import { describe, expect, it } from "vitest";
import { parseListPage, parseDetailPage } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年 本会議 第4回定例会会議録")).toBe(2025);
    expect(parseWarekiYear("令和6年 本会議 第1回臨時会")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年 本会議 第1回定例会会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成16年 本会議 第1回臨時会")).toBe(2004);
    expect(parseWarekiYear("平成30年 本会議 第4回定例会")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和7年 本会議 第4回定例会会議録")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和7年 本会議第1回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会会議録")).toBe("committee");
  });
});

describe("parseListPage", () => {
  it("詳細ページのURLを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/14575.html">令和7年 本会議 第4回定例会会議録</a></li>
        <li><a href="/site/gikai/11518.html">令和7年 本会議第1回臨時会</a></li>
        <li><a href="/site/gikai/2147.html">平成16年 本会議 第1回臨時会</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://www.town.suo-oshima.lg.jp/site/gikai/14575.html");
    expect(result[1]).toBe("https://www.town.suo-oshima.lg.jp/site/gikai/11518.html");
    expect(result[2]).toBe("https://www.town.suo-oshima.lg.jp/site/gikai/2147.html");
  });

  it("重複URLを除外する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/14575.html">令和7年 本会議 第4回定例会会議録</a></li>
        <li><a href="/site/gikai/14575.html">令和7年 本会議 第4回定例会会議録（再掲）</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.suo-oshima.lg.jp/site/gikai/14575.html");
  });

  it("/site/gikai/ パターン以外のリンクは無視する", () => {
    const html = `
      <a href="/site/gikai/list18.html">一覧に戻る</a>
      <a href="/site/gikai/14575.html">令和7年 本会議 第4回定例会会議録</a>
      <a href="/about/index.html">お問い合わせ</a>
    `;

    // list18.html は数値のみのパターンにマッチしないため除外される
    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.suo-oshima.lg.jp/site/gikai/14575.html");
  });

  it("詳細ページURLがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });
});

describe("parseDetailPage", () => {
  const detailUrl = "https://www.town.suo-oshima.lg.jp/site/gikai/14575.html";

  it("h2タイトルとPDFリンクを抽出する", () => {
    const html = `
      <html>
        <head><title>令和7年 本会議 第4回定例会会議録 | 周防大島町</title></head>
        <body>
          <h2 class="article-body-title">令和7年 本会議 第4回定例会会議録</h2>
          <table>
            <tr><td><a href="/uploaded/attachment/22500.pdf">目次</a></td></tr>
            <tr><td><a href="/uploaded/attachment/22501.pdf">第1日</a></td></tr>
            <tr><td><a href="/uploaded/attachment/22502.pdf">第2日</a></td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseDetailPage(html, detailUrl);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和7年 本会議 第4回定例会会議録");
    expect(result!.year).toBe(2025);
    expect(result!.meetingType).toBe("plenary");
    expect(result!.pdfUrls).toHaveLength(3);
    expect(result!.pdfUrls[0]).toBe("https://www.town.suo-oshima.lg.jp/uploaded/attachment/22500.pdf");
    expect(result!.pdfUrls[1]).toBe("https://www.town.suo-oshima.lg.jp/uploaded/attachment/22501.pdf");
    expect(result!.pdfUrls[2]).toBe("https://www.town.suo-oshima.lg.jp/uploaded/attachment/22502.pdf");
  });

  it("臨時会のmeetingTypeを正しく検出する", () => {
    const html = `
      <html>
        <head><title>令和7年 本会議第1回臨時会 | 周防大島町</title></head>
        <body>
          <h2 class="article-body-title">令和7年 本会議第1回臨時会</h2>
          <table>
            <tr><td><a href="/uploaded/attachment/11519.pdf">会議録</a></td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseDetailPage(html, "https://www.town.suo-oshima.lg.jp/site/gikai/11518.html");

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("平成16年の詳細ページを正しく解析する", () => {
    const html = `
      <html>
        <head><title>平成16年 本会議 第1回臨時会 | 周防大島町</title></head>
        <body>
          <h2 class="article-body-title">平成16年 本会議 第1回臨時会</h2>
          <table>
            <tr><td><a href="/uploaded/attachment/2148.pdf">会議録</a></td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseDetailPage(html, "https://www.town.suo-oshima.lg.jp/site/gikai/2147.html");

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2004);
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("PDFリンクがない場合はpdfUrlsが空配列になる", () => {
    const html = `
      <html>
        <head><title>令和7年 本会議 第4回定例会会議録 | 周防大島町</title></head>
        <body>
          <h2 class="article-body-title">令和7年 本会議 第4回定例会会議録</h2>
          <p>準備中</p>
        </body>
      </html>
    `;

    const result = parseDetailPage(html, detailUrl);

    expect(result).not.toBeNull();
    expect(result!.pdfUrls).toHaveLength(0);
  });

  it("和暦を含まないページはnullを返す", () => {
    const html = `
      <html>
        <head><title>議会トップページ | 周防大島町</title></head>
        <body><p>議会についての説明</p></body>
      </html>
    `;

    const result = parseDetailPage(html, detailUrl);

    expect(result).toBeNull();
  });

  it("サイト名を除いたタイトルを返す", () => {
    const html = `
      <html>
        <head><title>令和7年 本会議 第4回定例会会議録 | 周防大島町</title></head>
        <body>
          <h2 class="article-body-title">令和7年 本会議 第4回定例会会議録 | 周防大島町</h2>
        </body>
      </html>
    `;

    const result = parseDetailPage(html, detailUrl);

    expect(result).not.toBeNull();
    expect(result!.title).not.toContain("周防大島町");
  });
});
