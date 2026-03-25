import { describe, expect, it } from "vitest";
import {
  extractKakoPageUrls,
  extractSaishinPageUrls,
  parseDateFromLinkText,
  parsePdfLinks,
  extractYearFromHtml,
} from "./list";

describe("extractKakoPageUrls", () => {
  it("年度別詳細ページ URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/gikai/gyomu/kaigiroku/kako/2786.html">令和6年</a></li>
        <li><a href="/soshiki/gikai/gyomu/kaigiroku/kako/1547525225424.html">令和元年</a></li>
        <li><a href="/soshiki/gikai/gyomu/kaigiroku/kako/1453977741188.html">平成23年</a></li>
      </ul>
    `;

    const urls = extractKakoPageUrls(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/kako/2786.html");
    expect(urls[1]).toBe("https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/kako/1547525225424.html");
    expect(urls[2]).toBe("https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/kako/1453977741188.html");
  });

  it("index.html はスキップする", () => {
    const html = `
      <a href="/soshiki/gikai/gyomu/kaigiroku/kako/index.html">過去の会議録</a>
      <a href="/soshiki/gikai/gyomu/kaigiroku/kako/2786.html">令和6年</a>
    `;

    const urls = extractKakoPageUrls(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/kako/2786.html");
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/soshiki/gikai/gyomu/kaigiroku/kako/2786.html">令和6年</a>
      <a href="/soshiki/gikai/gyomu/kaigiroku/kako/2786.html">令和6年（再掲）</a>
    `;

    const urls = extractKakoPageUrls(html);
    expect(urls).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(extractKakoPageUrls(html)).toEqual([]);
  });
});

describe("extractSaishinPageUrls", () => {
  it("最新の会議録詳細ページ URL を抽出する", () => {
    const html = `
      <a href="/soshiki/gikai/gyomu/kaigiroku/saishinnokaigiroku/3106.html">最新の会議録</a>
    `;

    const urls = extractSaishinPageUrls(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/saishinnokaigiroku/3106.html");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>準備中</p>";
    expect(extractSaishinPageUrls(html)).toEqual([]);
  });
});

describe("parseDateFromLinkText", () => {
  it("9月3日 → 2024-09-03（年=2024）", () => {
    expect(parseDateFromLinkText("第1号 9月3日", 2024)).toBe("2024-09-03");
  });

  it("1月24日 → 2024-01-24（年=2024）", () => {
    expect(parseDateFromLinkText("第1号 1月24日", 2024)).toBe("2024-01-24");
  });

  it("12月3日 → 2024-12-03（年=2024）", () => {
    expect(parseDateFromLinkText("第1号 12月3日", 2024)).toBe("2024-12-03");
  });

  it("年が null の場合は null を返す", () => {
    expect(parseDateFromLinkText("第1号 9月3日", null)).toBeNull();
  });

  it("日付を含まない場合は null を返す", () => {
    expect(parseDateFromLinkText("会議録一覧", 2024)).toBeNull();
  });
});

describe("parsePdfLinks", () => {
  it("プロトコル相対 URL から PDF 情報を抽出する", () => {
    const html = `
      <html><body>
        <p><a href="//www.town.shirahama.wakayama.jp/material/files/group/51/20240124kaigiroku.pdf">第1号 1月24日</a></p>
        <p><a href="//www.town.shirahama.wakayama.jp/material/files/group/51/20240903kaigiroku.pdf">第1号 9月3日</a></p>
      </body></html>
    `;

    const yearPageUrl = "https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/kako/2786.html";
    const results = parsePdfLinks(html, yearPageUrl, "令和6年 会議録", 2024);

    expect(results).toHaveLength(2);

    expect(results[0]!.pdfUrl).toBe("https://www.town.shirahama.wakayama.jp/material/files/group/51/20240124kaigiroku.pdf");
    expect(results[0]!.title).toBe("令和6年 会議録 第1号 1月24日");
    expect(results[0]!.heldOn).toBe("2024-01-24");
    expect(results[0]!.meetingType).toBe("plenary");
    expect(results[0]!.yearPageUrl).toBe(yearPageUrl);

    expect(results[1]!.heldOn).toBe("2024-09-03");
  });

  it("臨時会 PDF の会議種別を正しく判定する", () => {
    const html = `
      <a href="//www.town.shirahama.wakayama.jp/material/files/group/51/20240501kaigiroku.pdf">臨時会 5月1日</a>
    `;

    const results = parsePdfLinks(html, "https://example.com/kako/123.html", "令和6年臨時会", 2024);
    expect(results[0]!.meetingType).toBe("extraordinary");
  });

  it("重複 PDF URL を除外する", () => {
    const html = `
      <a href="//www.town.shirahama.wakayama.jp/material/files/group/51/20240124kaigiroku.pdf">第1号 1月24日</a>
      <a href="//www.town.shirahama.wakayama.jp/material/files/group/51/20240124kaigiroku.pdf">第1号 1月24日（再掲）</a>
    `;

    const results = parsePdfLinks(html, "https://example.com/kako/123.html", "令和6年", 2024);
    expect(results).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>準備中です。</p>";
    const results = parsePdfLinks(html, "https://example.com/kako/123.html", "令和6年", 2024);
    expect(results).toEqual([]);
  });
});

describe("extractYearFromHtml", () => {
  it("title タグから令和年を抽出する", () => {
    const html = `<html><head><title>令和6年 会議録 | 白浜町</title></head></html>`;
    expect(extractYearFromHtml(html)).toBe(2024);
  });

  it("h1 タグから平成年を抽出する", () => {
    const html = `<html><body><h1>平成30年 会議録</h1></body></html>`;
    expect(extractYearFromHtml(html)).toBe(2018);
  });

  it("令和元年を正しく変換する", () => {
    const html = `<html><head><title>令和元年 会議録</title></head></html>`;
    expect(extractYearFromHtml(html)).toBe(2019);
  });

  it("年が見つからない場合は null を返す", () => {
    const html = `<html><body><p>会議録</p></body></html>`;
    expect(extractYearFromHtml(html)).toBeNull();
  });
});
