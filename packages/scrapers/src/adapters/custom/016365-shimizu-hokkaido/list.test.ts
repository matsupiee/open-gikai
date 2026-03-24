import { describe, expect, it } from "vitest";
import {
  parseNewSiteYearListPage,
  parseOldSiteYearListPage,
  parseSchedulePage,
  parseDateFromTitle,
  parseYearFromTitle,
  parseMeetingPageMeta,
} from "./list";

describe("parseNewSiteYearListPage", () => {
  it("ul.title-list 内のリンクを抽出する", () => {
    const html = `
      <html><body>
      <ul class="title-list">
        <li><a href="/gikai/proceeding/details/7594922.html">令和7年第5回定例会</a></li>
        <li><a href="/gikai/proceeding/details/74612620.html">令和7年第4回定例会</a></li>
      </ul>
      </body></html>
    `;
    const urls = parseNewSiteYearListPage(html, "https://www.town.shimizu.hokkaido.jp/gikai/proceeding/7/");
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/7594922.html");
    expect(urls[1]).toBe("https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/74612620.html");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul class="title-list">
        <li><a href="/gikai/proceeding/details/7594922.html">第5回定例会</a></li>
        <li><a href="/gikai/proceeding/details/7594922.html">第5回定例会（重複）</a></li>
      </ul>
    `;
    const urls = parseNewSiteYearListPage(html, "https://www.town.shimizu.hokkaido.jp/gikai/proceeding/7/");
    expect(urls).toHaveLength(1);
  });

  it("ul.title-list がない場合はページ全体から検索する", () => {
    const html = `
      <html><body>
        <a href="/gikai/proceeding/details/12345.html">定例会</a>
      </body></html>
    `;
    const urls = parseNewSiteYearListPage(html, "https://www.town.shimizu.hokkaido.jp/gikai/proceeding/7/");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/12345.html");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;
    const urls = parseNewSiteYearListPage(html, "https://www.town.shimizu.hokkaido.jp/gikai/proceeding/7/");
    expect(urls).toHaveLength(0);
  });
});

describe("parseOldSiteYearListPage", () => {
  it("../details/ 形式の相対パスリンクを解決する", () => {
    const html = `
      <html><body>
      <div id="contents_in">
        <a href="../details/12345678.html">平成28年第1回定例会</a>
        <a href="../details/87654321.html">平成28年第2回定例会</a>
      </div>
      </body></html>
    `;
    const baseUrl = "https://www.town.shimizu.hokkaido.jp/gikai/past/kaigiroku/28/index.html";
    const urls = parseOldSiteYearListPage(html, baseUrl);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://www.town.shimizu.hokkaido.jp/gikai/past/kaigiroku/details/12345678.html");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <a href="../details/12345678.html">定例会</a>
      <a href="../details/12345678.html">定例会（重複）</a>
    `;
    const baseUrl = "https://www.town.shimizu.hokkaido.jp/gikai/past/kaigiroku/28/index.html";
    const urls = parseOldSiteYearListPage(html, baseUrl);
    expect(urls).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;
    const baseUrl = "https://www.town.shimizu.hokkaido.jp/gikai/past/kaigiroku/28/index.html";
    const urls = parseOldSiteYearListPage(html, baseUrl);
    expect(urls).toHaveLength(0);
  });
});

describe("parseSchedulePage", () => {
  it("「当日の全会議録へ」リンクを抽出する", () => {
    const html = `
      <html><body>
      <h1 class="page-title">令和7年第5回清水町議会定例会（9月4日～9月22日） 議事日程表</h1>
      <table class="table-gray">
        <tr>
          <td>9月4日（木）</td>
          <td><a href="/gikai/proceeding/details/99001234.html">当日の全会議録へ</a></td>
        </tr>
        <tr>
          <td>9月5日（金）</td>
          <td><a href="/gikai/proceeding/details/99005678.html">当日の全会議録へ</a></td>
        </tr>
      </table>
      </body></html>
    `;
    const scheduleUrl = "https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/7594922.html";
    const records = parseSchedulePage(html, scheduleUrl);
    expect(records).toHaveLength(2);
    expect(records[0]!.pageUrl).toBe("https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/99001234.html");
    expect(records[0]!.pageKey).toBe("016365_proceeding_99001234");
    expect(records[0]!.category).toBe("plenary");
    expect(records[1]!.pageUrl).toBe("https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/99005678.html");
  });

  it("臨時会の場合 category が extraordinary になる", () => {
    const html = `
      <html><body>
      <h1 class="page-title">令和7年第1回清水町議会臨時会（6月1日） 議事日程表</h1>
      <table>
        <tr>
          <td><a href="/gikai/proceeding/details/11112222.html">当日の全会議録へ</a></td>
        </tr>
      </table>
      </body></html>
    `;
    const scheduleUrl = "https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/9876543.html";
    const records = parseSchedulePage(html, scheduleUrl);
    expect(records[0]!.category).toBe("extraordinary");
  });

  it("「当日の全会議録へ」リンクがない場合は他のリンクをフォールバックとして収集する", () => {
    const html = `
      <html><body>
      <h1 class="page-title">令和7年第5回清水町議会定例会 議事日程表</h1>
      <a href="/gikai/proceeding/details/55556666.html">会議録を見る</a>
      </body></html>
    `;
    const scheduleUrl = "https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/1111111.html";
    const records = parseSchedulePage(html, scheduleUrl);
    expect(records).toHaveLength(1);
    expect(records[0]!.pageUrl).toBe("https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/55556666.html");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>リンクなし</p></body></html>`;
    const scheduleUrl = "https://www.town.shimizu.hokkaido.jp/gikai/proceeding/details/1111111.html";
    const records = parseSchedulePage(html, scheduleUrl);
    expect(records).toHaveLength(0);
  });
});

describe("parseDateFromTitle", () => {
  it("（9月4日）形式の日付をパースする", () => {
    expect(parseDateFromTitle("令和7年第5回定例会会議録（9月4日）", 2025)).toBe("2025-09-04");
  });

  it("（3月6日）形式の日付をパースする", () => {
    expect(parseDateFromTitle("令和6年第1回定例会会議録（3月6日）", 2024)).toBe("2024-03-06");
  });

  it("全角数字（１月１日）形式をパースする", () => {
    expect(parseDateFromTitle("令和7年第1回定例会会議録（１月１日）", 2025)).toBe("2025-01-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromTitle("令和7年第5回定例会会議録", 2025)).toBeNull();
  });
});

describe("parseYearFromTitle", () => {
  it("令和7年を 2025 に変換する", () => {
    expect(parseYearFromTitle("令和7年第5回定例会会議録（9月4日）")).toBe(2025);
  });

  it("令和元年を 2019 に変換する", () => {
    expect(parseYearFromTitle("令和元年第1回定例会会議録（6月3日）")).toBe(2019);
  });

  it("平成29年を 2017 に変換する", () => {
    expect(parseYearFromTitle("平成29年第1回定例会会議録（3月6日）")).toBe(2017);
  });

  it("年がない場合は null を返す", () => {
    expect(parseYearFromTitle("定例会会議録")).toBeNull();
  });
});

describe("parseMeetingPageMeta", () => {
  it("新サイトの page-title から情報を抽出する", () => {
    const html = `
      <html><body>
      <h1 class="page-title">令和7年第5回定例会会議録（9月4日）</h1>
      <p>会議の内容</p>
      </body></html>
    `;
    const meta = parseMeetingPageMeta(html, 2025);
    expect(meta.title).toBe("令和7年第5回定例会会議録（9月4日）");
    expect(meta.heldOn).toBe("2025-09-04");
    expect(meta.category).toBe("plenary");
  });

  it("臨時会の場合 category が extraordinary になる", () => {
    const html = `
      <html><body>
      <h1 class="page-title">令和7年第1回臨時会会議録（6月1日）</h1>
      </body></html>
    `;
    const meta = parseMeetingPageMeta(html, 2025);
    expect(meta.category).toBe("extraordinary");
  });
});
