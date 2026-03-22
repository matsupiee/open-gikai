import { describe, expect, it } from "vitest";
import {
  parseYearPages,
  parseMeetingLinks,
  extractSessionRecords,
} from "./list";
import { parseNendo, parseWarekiYear } from "./shared";

describe("parseNendo", () => {
  it("令和の年度を変換する", () => {
    expect(parseNendo("令和7年度")).toBe(2025);
    expect(parseNendo("令和6年度")).toBe(2024);
    expect(parseNendo("令和元年度")).toBe(2019);
  });

  it("平成の年度を変換する", () => {
    expect(parseNendo("平成30年度")).toBe(2018);
    expect(parseNendo("平成元年度")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseNendo("2024年度")).toBeNull();
    expect(parseNendo("")).toBeNull();
  });
});

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年6月開催")).toBe(2024);
    expect(parseWarekiYear("令和8年2月開催")).toBe(2026);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年12月開催")).toBe(2018);
  });
});

describe("parseYearPages", () => {
  it("年度ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/shigikai/list18-63.html">令和7年度</a></li>
        <li><a href="/site/shigikai/list18-64.html">令和6年度</a></li>
        <li><a href="/site/shigikai/list18-82.html">平成18年度</a></li>
      </ul>
    `;

    const result = parseYearPages(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      nendo: 2025,
      url: "https://www.city.iizuka.lg.jp/site/shigikai/list18-63.html",
    });
    expect(result[1]).toEqual({
      nendo: 2024,
      url: "https://www.city.iizuka.lg.jp/site/shigikai/list18-64.html",
    });
    expect(result[2]).toEqual({
      nendo: 2006,
      url: "https://www.city.iizuka.lg.jp/site/shigikai/list18-82.html",
    });
  });

  it("年度リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseYearPages(html)).toEqual([]);
  });
});

describe("parseMeetingLinks", () => {
  it("会議詳細ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/shigikai/2360.html">第2回定例会(令和6年6月開催)</a></li>
        <li><a href="/site/shigikai/1995.html">議会運営委員会</a></li>
      </ul>
    `;

    const result = parseMeetingLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第2回定例会(令和6年6月開催)",
      url: "https://www.city.iizuka.lg.jp/site/shigikai/2360.html",
      pageId: "2360",
    });
    expect(result[1]).toEqual({
      title: "議会運営委員会",
      url: "https://www.city.iizuka.lg.jp/site/shigikai/1995.html",
      pageId: "1995",
    });
  });

  it("重複するページIDを除外する", () => {
    const html = `
      <a href="/site/shigikai/2360.html">第2回定例会</a>
      <a href="/site/shigikai/2360.html">第2回定例会(重複)</a>
    `;

    const result = parseMeetingLinks(html);
    expect(result).toHaveLength(1);
  });
});

describe("extractSessionRecords", () => {
  it("セッション日PDFを抽出する", () => {
    const html = `
      <table>
        <tr><td><a href="/uploaded/attachment/9076.pdf">会期日程（PDFファイル：73KB）</a></td></tr>
        <tr><td><a href="/uploaded/attachment/9078.pdf">議案付託一覧表（PDFファイル：100KB）</a></td></tr>
        <tr><td><a href="/uploaded/attachment/9080.pdf">目次（PDFファイル：50KB）</a></td></tr>
        <tr><td><a href="/uploaded/attachment/9082.pdf">6月12日（第1号）（PDFファイル：548KB）</a></td></tr>
        <tr><td><a href="/uploaded/attachment/9084.pdf">6月17日（第2号）（PDFファイル：1.01MB）</a></td></tr>
        <tr><td><a href="/uploaded/attachment/9086.pdf">6月18日（第3号）（PDFファイル：870KB）</a></td></tr>
      </table>
    `;

    const result = extractSessionRecords(html, "第2回定例会(令和6年6月開催)", "2360");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "第2回定例会 6月12日（第1号）",
      heldOn: "2024-06-12",
      pdfUrl: "https://www.city.iizuka.lg.jp/uploaded/attachment/9082.pdf",
      meetingType: "plenary",
      pageId: "2360",
    });
    expect(result[1]!.heldOn).toBe("2024-06-17");
    expect(result[2]!.heldOn).toBe("2024-06-18");
  });

  it("委員会を正しく分類する", () => {
    const html = `
      <a href="/uploaded/attachment/1234.pdf">3月13日（第1号）（PDFファイル：100KB）</a>
    `;

    const result = extractSessionRecords(html, "総務委員会(令和8年3月開催)", "1234");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("committee");
  });

  it("年度をまたぐケースを処理する", () => {
    const html = `
      <a href="/uploaded/attachment/5000.pdf">12月3日（第1号）（PDFファイル：100KB）</a>
      <a href="/uploaded/attachment/5001.pdf">1月15日（第2号）（PDFファイル：100KB）</a>
    `;

    const result = extractSessionRecords(html, "第5回定例会(令和7年12月開催)", "5000");

    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2025-12-03");
    expect(result[1]!.heldOn).toBe("2026-01-15");
  });

  it("和暦が解析できないタイトルでは空配列を返す", () => {
    const html = `
      <a href="/uploaded/attachment/1234.pdf">6月12日（第1号）</a>
    `;

    const result = extractSessionRecords(html, "Unknown Title", "1234");
    expect(result).toEqual([]);
  });

  it("会期日程・一覧・目次を除外する", () => {
    const html = `
      <a href="/uploaded/attachment/1000.pdf">会期日程（PDFファイル：73KB）</a>
      <a href="/uploaded/attachment/1001.pdf">議案付託一覧表（PDFファイル：100KB）</a>
      <a href="/uploaded/attachment/1002.pdf">目次（PDFファイル：50KB）</a>
    `;

    const result = extractSessionRecords(html, "第2回定例会(令和6年6月開催)", "1000");
    expect(result).toEqual([]);
  });
});
