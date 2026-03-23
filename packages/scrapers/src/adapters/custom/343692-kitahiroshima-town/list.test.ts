import { describe, expect, it } from "vitest";
import { parseTopPage, parseYearIndexPage, parseDetailPage } from "./list";

describe("parseTopPage", () => {
  it("年度別一覧ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/site/gikai/list98-1125.html">令和7年</a></li>
          <li><a href="/site/gikai/list98-968.html">令和6年</a></li>
          <li><a href="/site/gikai/list98-902.html">令和5年</a></li>
          <li><a href="/site/gikai/list98-850.html">令和4年</a></li>
          <li><a href="/site/gikai/list98-325.html">バックナンバー</a></li>
        </ul>
      </body>
      </html>
    `;

    const urls = parseTopPage(html);

    expect(urls).toContain("https://www.town.kitahiroshima.lg.jp/site/gikai/list98-1125.html");
    expect(urls).toContain("https://www.town.kitahiroshima.lg.jp/site/gikai/list98-968.html");
    expect(urls).toContain("https://www.town.kitahiroshima.lg.jp/site/gikai/list98-325.html");
  });

  it("重複するURLは1件のみ返す", () => {
    const html = `
      <a href="/site/gikai/list98-968.html">令和6年</a>
      <a href="/site/gikai/list98-968.html">令和6年（再掲）</a>
    `;

    const urls = parseTopPage(html);
    const count = urls.filter((u) =>
      u.includes("list98-968"),
    ).length;
    expect(count).toBe(1);
  });
});

describe("parseYearIndexPage", () => {
  it("会議録詳細ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/site/gikai/41620.html">令和6年会議録</a></li>
        </ul>
      </body>
      </html>
    `;

    const urls = parseYearIndexPage(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.kitahiroshima.lg.jp/site/gikai/41620.html");
  });

  it("list98-XXX.html 形式のリンクは抽出しない", () => {
    const html = `
      <a href="/site/gikai/list98-968.html">一覧ページ</a>
      <a href="/site/gikai/41620.html">詳細ページ</a>
    `;

    const urls = parseYearIndexPage(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.kitahiroshima.lg.jp/site/gikai/41620.html");
  });

  it("重複するURLは1件のみ返す", () => {
    const html = `
      <a href="/site/gikai/41620.html">令和6年会議録</a>
      <a href="/site/gikai/41620.html">令和6年会議録（再掲）</a>
    `;

    const urls = parseYearIndexPage(html);
    expect(urls).toHaveLength(1);
  });
});

describe("parseDetailPage", () => {
  it("h2セクションと PDF リンクを紐付けてメタ情報を抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和6年第1回臨時会</h2>
        <ul>
          <li><a href="/uploaded/attachment/22457.pdf">令和6年1月30日　会議録 [PDFファイル／179KB]</a></li>
        </ul>
        <h2>令和6年第1回定例会</h2>
        <ul>
          <li><a href="/uploaded/attachment/22900.pdf">令和6年2月27日　会議録 [PDFファイル／350KB]</a></li>
          <li><a href="/uploaded/attachment/22901.pdf">令和6年2月28日　会議録 [PDFファイル／250KB]</a></li>
        </ul>
      </body>
      </html>
    `;

    const items = parseDetailPage(html, "https://www.town.kitahiroshima.lg.jp/site/gikai/41620.html");

    expect(items).toHaveLength(3);

    expect(items[0]!.pdfUrl).toBe("https://www.town.kitahiroshima.lg.jp/uploaded/attachment/22457.pdf");
    expect(items[0]!.heldOn).toBe("2024-01-30");
    expect(items[0]!.meetingType).toBe("extraordinary");
    expect(items[0]!.sessionLabel).toBe("第1回臨時会");
    expect(items[0]!.year).toBe(2024);

    expect(items[1]!.pdfUrl).toBe("https://www.town.kitahiroshima.lg.jp/uploaded/attachment/22900.pdf");
    expect(items[1]!.heldOn).toBe("2024-02-27");
    expect(items[1]!.meetingType).toBe("plenary");
    expect(items[1]!.sessionLabel).toBe("第1回定例会");

    expect(items[2]!.heldOn).toBe("2024-02-28");
  });

  it("平成の日付を正しく西暦変換する", () => {
    const html = `
      <h2>平成30年第1回定例会</h2>
      <ul>
        <li><a href="/uploaded/attachment/1234.pdf">平成30年3月5日　会議録 [PDFファイル／200KB]</a></li>
      </ul>
    `;

    const items = parseDetailPage(html, "https://www.town.kitahiroshima.lg.jp/site/gikai/2823.html");

    expect(items).toHaveLength(1);
    expect(items[0]!.heldOn).toBe("2018-03-05");
    expect(items[0]!.year).toBe(2018);
  });

  it("PDFリンクが存在しない場合は空配列を返す", () => {
    const html = `
      <h2>令和6年第1回定例会</h2>
      <ul>
        <li>準備中</li>
      </ul>
    `;

    const items = parseDetailPage(html, "https://www.town.kitahiroshima.lg.jp/site/gikai/41620.html");
    expect(items).toHaveLength(0);
  });

  it("attachment 以外のPDFリンクは抽出しない", () => {
    const html = `
      <h2>令和6年第1回定例会</h2>
      <ul>
        <li><a href="/other/path/file.pdf">令和6年2月27日　会議録</a></li>
        <li><a href="/uploaded/attachment/22900.pdf">令和6年2月27日　会議録 [PDFファイル／350KB]</a></li>
      </ul>
    `;

    const items = parseDetailPage(html, "https://www.town.kitahiroshima.lg.jp/site/gikai/41620.html");
    expect(items).toHaveLength(1);
    expect(items[0]!.pdfUrl).toBe("https://www.town.kitahiroshima.lg.jp/uploaded/attachment/22900.pdf");
  });
});
