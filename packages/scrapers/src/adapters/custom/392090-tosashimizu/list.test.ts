import { describe, it, expect } from "vitest";
import {
  parseListPage,
  parseMeetingTitleFromDetailPage,
  parseDetailPage,
  parseMeetingDateFromText,
  parseYearFromTitle,
} from "./list";

const BASE_URL = "https://www.city.tosashimizu.kochi.jp";
const DETAIL_URL = `${BASE_URL}/kurashi/section/gikai/22293.html`;

describe("parseListPage", () => {
  it("詳細ページへのリンクを抽出する", () => {
    const html = `
      <a href="/kurashi/section/gikai/22293.html">令和7年6月会議</a>
      <a href="/kurashi/section/gikai/21000.html">令和6年12月会議</a>
    `;

    const urls = parseListPage(html);

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(`${BASE_URL}/kurashi/section/gikai/22293.html`);
    expect(urls[1]).toBe(`${BASE_URL}/kurashi/section/gikai/21000.html`);
  });

  it("旧形式（3桁連番）のリンクも抽出する", () => {
    const html = `
      <a href="/kurashi/section/gikai/040.html">平成24年3月定例会</a>
      <a href="/kurashi/section/gikai/041.html">平成24年6月定例会</a>
    `;

    const urls = parseListPage(html);

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(`${BASE_URL}/kurashi/section/gikai/040.html`);
    expect(urls[1]).toBe(`${BASE_URL}/kurashi/section/gikai/041.html`);
  });

  it("042.html（一覧ページ自身）はスキップする", () => {
    const html = `
      <a href="/kurashi/section/gikai/042.html">会議録一覧</a>
      <a href="/kurashi/section/gikai/22293.html">令和7年6月会議</a>
    `;

    const urls = parseListPage(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(`${BASE_URL}/kurashi/section/gikai/22293.html`);
  });

  it("重複リンクを除去する", () => {
    const html = `
      <a href="/kurashi/section/gikai/22293.html">令和7年6月会議</a>
      <a href="/kurashi/section/gikai/22293.html">令和7年6月会議（再掲）</a>
    `;

    const urls = parseListPage(html);

    expect(urls).toHaveLength(1);
  });

  it("絶対 URL のリンクを正しく処理する", () => {
    const html = `
      <a href="https://www.city.tosashimizu.kochi.jp/kurashi/section/gikai/22293.html">令和7年6月会議</a>
    `;

    const urls = parseListPage(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://www.city.tosashimizu.kochi.jp/kurashi/section/gikai/22293.html"
    );
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません。</p></div>`;

    const urls = parseListPage(html);

    expect(urls).toHaveLength(0);
  });
});

describe("parseMeetingTitleFromDetailPage", () => {
  it("h1 タグから会議タイトルを取得する", () => {
    const html = `<h1>令和7年定例会6月会議会議録</h1>`;

    const title = parseMeetingTitleFromDetailPage(html);

    expect(title).toBe("令和7年定例会6月会議会議録");
  });

  it("h2 タグから会議タイトルを取得する", () => {
    const html = `<h2>令和6年12月会議会議録</h2>`;

    const title = parseMeetingTitleFromDetailPage(html);

    expect(title).toBe("令和6年12月会議会議録");
  });

  it("会議が含まれない h1 はスキップして h2 を参照する", () => {
    const html = `
      <h1>土佐清水市議会</h1>
      <h2>令和6年12月会議会議録</h2>
    `;

    const title = parseMeetingTitleFromDetailPage(html);

    expect(title).toBe("令和6年12月会議会議録");
  });

  it("title タグにフォールバックする", () => {
    const html = `<title>令和6年定例会9月会議 | 土佐清水市</title>`;

    const title = parseMeetingTitleFromDetailPage(html);

    expect(title).toBe("令和6年定例会9月会議 | 土佐清水市");
  });
});

describe("parseDetailPage", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <a href="/fs/1/2/3/4/5/6/_/R7.6.9saikaibi.pdf">令和7年6月会議 開会日</a>
      <a href="/fs/1/2/3/4/5/6/_/R7.6.16sansankai.pdf">令和7年6月会議 3・4日目</a>
    `;

    const meetings = parseDetailPage(html, DETAIL_URL, "令和7年定例会6月会議");

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      `${BASE_URL}/fs/1/2/3/4/5/6/_/R7.6.9saikaibi.pdf`
    );
    expect(meetings[0]!.title).toBe("令和7年6月会議 開会日");
    expect(meetings[0]!.meetingTitle).toBe("令和7年定例会6月会議");
    expect(meetings[0]!.detailUrl).toBe(DETAIL_URL);
    expect(meetings[1]!.pdfUrl).toBe(
      `${BASE_URL}/fs/1/2/3/4/5/6/_/R7.6.16sansankai.pdf`
    );
  });

  it("4階層 /fs/ パスの PDF URL を正しく構築する", () => {
    const html = `
      <a href="/fs/1/2/3/4/_/cou06_01.pdf">平成24年3月定例会 第1号</a>
    `;

    const meetings = parseDetailPage(html, DETAIL_URL, "平成24年3月定例会");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      `${BASE_URL}/fs/1/2/3/4/_/cou06_01.pdf`
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>PDF はありません。</p></div>`;

    const meetings = parseDetailPage(html, DETAIL_URL, "");

    expect(meetings).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクもそのまま使用する", () => {
    const html = `
      <a href="https://www.city.tosashimizu.kochi.jp/fs/1/2/3/4/_/test.pdf">テスト会議</a>
    `;

    const meetings = parseDetailPage(html, DETAIL_URL, "");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.tosashimizu.kochi.jp/fs/1/2/3/4/_/test.pdf"
    );
  });
});

describe("parseMeetingDateFromText", () => {
  it("令和年月日を YYYY-MM-DD にパースする", () => {
    const text = `令和7年6月9日（月曜日）　午前10時00分開議`;

    expect(parseMeetingDateFromText(text)).toBe("2025-06-09");
  });

  it("平成年月日を YYYY-MM-DD にパースする", () => {
    const text = `平成30年3月5日（月曜日）　午前10時開議`;

    expect(parseMeetingDateFromText(text)).toBe("2018-03-05");
  });

  it("全角数字を含む日付をパースする", () => {
    const text = `令和７年６月９日（月曜日）　午前１０時００分開議`;

    expect(parseMeetingDateFromText(text)).toBe("2025-06-09");
  });

  it("令和元年をパースする", () => {
    const text = `令和元年6月10日（月曜日）`;

    expect(parseMeetingDateFromText(text)).toBe("2019-06-10");
  });

  it("日付が見つからない場合は null を返す", () => {
    expect(parseMeetingDateFromText("会議録テキスト")).toBeNull();
  });
});

describe("parseYearFromTitle", () => {
  it("令和のタイトルから西暦年を取得する", () => {
    expect(parseYearFromTitle("令和7年定例会6月会議")).toBe(2025);
  });

  it("平成のタイトルから西暦年を取得する", () => {
    expect(parseYearFromTitle("平成30年9月定例会")).toBe(2018);
  });

  it("令和元年を正しく変換する", () => {
    expect(parseYearFromTitle("令和元年6月会議")).toBe(2019);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(parseYearFromTitle("会議録")).toBeNull();
  });
});
