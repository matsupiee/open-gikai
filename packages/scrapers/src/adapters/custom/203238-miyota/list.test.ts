import { describe, expect, it } from "vitest";
import {
  parseYearCategoryUrls,
  parseSessionLinks,
  parsePdfUrls,
  extractYearFromTitle,
} from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和６年第４回定例会")).toBe(2024);
    expect(parseWarekiYear("令和７年第１回定例会")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第１回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成３１年第１回定例会")).toBe(2019);
    expect(parseWarekiYear("平成２５年第１回定例会")).toBe(2013);
  });

  it("全角数字を正しく変換する", () => {
    expect(parseWarekiYear("令和６年")).toBe(2024);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和６年第４回御代田町議会定例会会議録")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和６年第１回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearCategoryUrls", () => {
  it("相対パス形式の年度カテゴリ URL を抽出する（実際のサイト形式）", () => {
    const html = `
      <ul>
        <li><a href="../../category/reiwarokunenkaigiroku/index.html">令和6年</a></li>
        <li><a href="../../category/reiwagonennkaigiroku/index.html">令和5年</a></li>
        <li><a href="../../category/reiwayonenn/index.html">令和4年</a></li>
      </ul>
    `;

    const result = parseYearCategoryUrls(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://www.town.miyota.nagano.jp/category/reiwarokunenkaigiroku/index.html");
    expect(result[1]).toBe("https://www.town.miyota.nagano.jp/category/reiwagonennkaigiroku/index.html");
    expect(result[2]).toBe("https://www.town.miyota.nagano.jp/category/reiwayonenn/index.html");
  });

  it("絶対パス形式の年度カテゴリ URL も抽出できる", () => {
    const html = `
      <a href="/category/reiwarokunenkaigiroku/index.html">令和6年</a>
    `;

    const result = parseYearCategoryUrls(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.miyota.nagano.jp/category/reiwarokunenkaigiroku/index.html");
  });

  it("kaigiroku 自身のリンクは除外する", () => {
    const html = `
      <a href="../../category/kaigiroku/index.html">会議録一覧</a>
      <a href="../../category/reiwarokunenkaigiroku/index.html">令和6年</a>
    `;

    const result = parseYearCategoryUrls(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.miyota.nagano.jp/category/reiwarokunenkaigiroku/index.html");
  });

  it("会議録以外のカテゴリは除外する", () => {
    const html = `
      <a href="../../category/gikai/index.html">議会</a>
      <a href="../../category/kyouiku/index.html">教育</a>
      <a href="../../category/reiwarokunenkaigiroku/index.html">令和6年</a>
      <a href="../../category/kaigih31/index.html">平成31年</a>
    `;

    const result = parseYearCategoryUrls(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("https://www.town.miyota.nagano.jp/category/reiwarokunenkaigiroku/index.html");
    expect(result[1]).toBe("https://www.town.miyota.nagano.jp/category/kaigih31/index.html");
  });

  it("重複する URL は一度のみ含まれる", () => {
    const html = `
      <a href="../../category/reiwarokunenkaigiroku/index.html">令和6年</a>
      <a href="../../category/reiwarokunenkaigiroku/index.html">令和6年（再掲）</a>
    `;

    const result = parseYearCategoryUrls(html);
    expect(result).toHaveLength(1);
  });

  it("カテゴリ URL がない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseYearCategoryUrls(html)).toEqual([]);
  });
});

describe("parseSessionLinks", () => {
  it("相対パス形式の定例会詳細ページリンクを抽出する（実際のサイト形式）", () => {
    const categorySlug = "reiwarokunenkaigiroku";
    const html = `
      <ul>
        <li><a href="../../category/reiwarokunenkaigiroku/168536.html">令和６年第４回御代田町議会定例会会議録</a></li>
        <li><a href="../../category/reiwarokunenkaigiroku/166187.html">令和６年第３回御代田町議会定例会会議録</a></li>
      </ul>
    `;

    const result = parseSessionLinks(html, categorySlug);

    expect(result).toHaveLength(2);
    expect(result[0]!.url).toBe("https://www.town.miyota.nagano.jp/category/reiwarokunenkaigiroku/168536.html");
    expect(result[0]!.title).toBe("令和６年第４回御代田町議会定例会会議録");
    expect(result[1]!.url).toBe("https://www.town.miyota.nagano.jp/category/reiwarokunenkaigiroku/166187.html");
  });

  it("index.html は除外する", () => {
    const categorySlug = "reiwarokunenkaigiroku";
    const html = `
      <a href="../../category/reiwarokunenkaigiroku/index.html">トップ</a>
      <a href="../../category/reiwarokunenkaigiroku/168536.html">令和６年第４回定例会</a>
    `;

    const result = parseSessionLinks(html, categorySlug);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const result = parseSessionLinks("<p>準備中</p>", "reiwarokunenkaigiroku");
    expect(result).toEqual([]);
  });
});

describe("parsePdfUrls", () => {
  it("相対パス形式の PDF URL を抽出する（実際のサイト形式）", () => {
    const html = `
      <ul>
        <li><a href="../../file/154352.pdf">12月3日（一般質問）</a></li>
        <li><a href="../../file/154353.pdf">12月4日（一般質問）</a></li>
        <li><a href="../../file/154354.pdf">12月16日（委員長報告・採決）</a></li>
      </ul>
    `;

    const result = parsePdfUrls(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://www.town.miyota.nagano.jp/file/154352.pdf");
    expect(result[1]).toBe("https://www.town.miyota.nagano.jp/file/154353.pdf");
    expect(result[2]).toBe("https://www.town.miyota.nagano.jp/file/154354.pdf");
  });

  it("絶対パス形式の PDF URL も抽出できる", () => {
    const html = `
      <a href="/file/154352.pdf">PDF</a>
    `;

    const result = parsePdfUrls(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.miyota.nagano.jp/file/154352.pdf");
  });

  it("重複する URL は一度のみ含まれる", () => {
    const html = `
      <a href="../../file/154352.pdf">PDF1</a>
      <a href="../../file/154352.pdf">PDF1（再掲）</a>
    `;

    const result = parsePdfUrls(html);
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>準備中</p>";
    expect(parsePdfUrls(html)).toEqual([]);
  });
});

describe("extractYearFromTitle", () => {
  it("令和の定例会タイトルから年を抽出する", () => {
    expect(extractYearFromTitle("令和６年第４回御代田町議会定例会会議録")).toBe(2024);
    expect(extractYearFromTitle("令和７年第１回御代田町議会定例会会議録")).toBe(2025);
  });

  it("令和元年から年を抽出する", () => {
    expect(extractYearFromTitle("令和元年第２回定例会")).toBe(2019);
  });

  it("平成の定例会タイトルから年を抽出する", () => {
    expect(extractYearFromTitle("平成２５年第１回定例会")).toBe(2013);
  });

  it("タイトルから年が抽出できない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録一覧")).toBeNull();
  });
});
