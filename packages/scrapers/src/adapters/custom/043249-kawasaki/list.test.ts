import { describe, expect, it } from "vitest";
import { parseTopPageLinks, parsePdfLinks, inferYearFromLinkText } from "./list";

describe("parseTopPageLinks", () => {
  it("会議録ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/site/gikai/10823.html">令和7年 会議録</a></li>
          <li><a href="/site/gikai/10821.html">令和6年 会議録</a></li>
          <li><a href="/site/gikai/455.html">令和2年 会議録（12月会議）</a></li>
          <li><a href="/site/gikai/list6-25.html">一覧ページ（除外対象）</a></li>
          <li><a href="/about/">関係ないリンク</a></li>
        </ul>
      </body>
      </html>
    `;

    const links = parseTopPageLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.url).toBe("https://www.town.kawasaki.miyagi.jp/site/gikai/10823.html");
    expect(links[0]!.text).toBe("令和7年 会議録");
    expect(links[1]!.url).toBe("https://www.town.kawasaki.miyagi.jp/site/gikai/10821.html");
    expect(links[2]!.url).toBe("https://www.town.kawasaki.miyagi.jp/site/gikai/455.html");
    expect(links[2]!.text).toBe("令和2年 会議録（12月会議）");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/10823.html">令和7年 会議録</a></li>
        <li><a href="/site/gikai/10823.html">令和7年 会議録</a></li>
      </ul>
    `;

    const links = parseTopPageLinks(html);
    expect(links).toHaveLength(1);
  });

  it("会議録関連リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const links = parseTopPageLinks(html);
    expect(links).toHaveLength(0);
  });
});

describe("parsePdfLinks", () => {
  it("h2 見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和7年3月定例会</h2>
        <ul>
          <li><a href="/uploaded/attachment/8930.pdf">令和7年3月5日（第2号）</a> [PDFファイル／442KB]</li>
          <li><a href="/uploaded/attachment/8931.pdf">令和7年3月6日（第3号）</a> [PDFファイル／300KB]</li>
        </ul>
        <h2>令和6年12月定例会</h2>
        <ul>
          <li><a href="/uploaded/attachment/8000.pdf">令和6年12月7日（第2号）</a> [PDFファイル／400KB]</li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parsePdfLinks(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toBe("https://www.town.kawasaki.miyagi.jp/uploaded/attachment/8930.pdf");
    expect(meetings[0]!.title).toBe("令和7年3月5日（第2号）");
    expect(meetings[0]!.sessionTitle).toBe("令和7年3月定例会");
    expect(meetings[0]!.heldOn).toBe("2025-03-05");
    expect(meetings[0]!.type).toBe("pdf");

    expect(meetings[1]!.pdfUrl).toBe("https://www.town.kawasaki.miyagi.jp/uploaded/attachment/8931.pdf");
    expect(meetings[1]!.heldOn).toBe("2025-03-06");

    expect(meetings[2]!.pdfUrl).toBe("https://www.town.kawasaki.miyagi.jp/uploaded/attachment/8000.pdf");
    expect(meetings[2]!.heldOn).toBe("2024-12-07");
    expect(meetings[2]!.sessionTitle).toBe("令和6年12月定例会");
  });

  it("日付が解析できない PDF リンクはスキップする", () => {
    const html = `
      <h2>令和7年3月定例会</h2>
      <ul>
        <li><a href="/uploaded/attachment/9999.pdf">日付なしリンク</a></li>
        <li><a href="/uploaded/attachment/8930.pdf">令和7年3月5日（第2号）</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-03-05");
  });

  it("定例会・臨時会以外の h2 見出しはスキップする", () => {
    const html = `
      <h2>お知らせ</h2>
      <ul>
        <li><a href="/uploaded/attachment/1234.pdf">令和7年3月5日（第2号）</a></li>
      </ul>
      <h2>令和7年3月定例会</h2>
      <ul>
        <li><a href="/uploaded/attachment/8930.pdf">令和7年3月5日（第2号）</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.sessionTitle).toBe("令和7年3月定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><h2>令和7年3月定例会</h2><p>内容なし</p></body></html>`;
    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(0);
  });

  it("平成の日付も正しくパースする", () => {
    const html = `
      <h2>平成30年12月定例会</h2>
      <ul>
        <li><a href="/uploaded/attachment/100.pdf">平成30年12月10日（第2号）</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-12-10");
  });
});

describe("inferYearFromLinkText", () => {
  it("令和7年を正しく変換する", () => {
    expect(inferYearFromLinkText("令和7年 会議録")).toBe(2025);
  });

  it("令和元年を正しく変換する", () => {
    expect(inferYearFromLinkText("令和元年 会議録（12月会議）")).toBe(2019);
  });

  it("平成31年を正しく変換する", () => {
    expect(inferYearFromLinkText("平成31年 会議録（3月会議）")).toBe(2019);
  });

  it("令和2年を正しく変換する", () => {
    expect(inferYearFromLinkText("令和2年 会議録（9月会議）")).toBe(2020);
  });

  it("年が取得できない場合は null を返す", () => {
    expect(inferYearFromLinkText("会議録一覧")).toBeNull();
  });
});
