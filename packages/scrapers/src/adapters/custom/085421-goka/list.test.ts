import { describe, expect, it } from "vitest";
import {
  extractYearFromTitle,
  parseMeetingPage,
  parseTopPage,
  parseYearPage,
} from "./list";

describe("parseTopPage", () => {
  it("年度別サブページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.goka.lg.jp/kurashi-machi-shigoto/gyousei/gyousei-notice/gikai/shingikeeka-kaigiroku/reiwa8nen/">令和8年</a></li>
        <li><a href="https://www.town.goka.lg.jp/kurashi-machi-shigoto/gyousei/gyousei-notice/gikai/shingikeeka-kaigiroku/gikaijimukyoku/">令和7年</a></li>
        <li><a href="https://www.town.goka.lg.jp/kurashi-machi-shigoto/gyousei/gyousei-notice/gikai/shingikeeka-kaigiroku/reiwa6/">令和6年</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和8年");
    expect(pages[0]!.url).toBe(
      "https://www.town.goka.lg.jp/kurashi-machi-shigoto/gyousei/gyousei-notice/gikai/shingikeeka-kaigiroku/reiwa8nen/",
    );
    expect(pages[1]!.label).toBe("令和7年");
    expect(pages[2]!.label).toBe("令和6年");
  });

  it("定例会・臨時会リンクはスキップする", () => {
    const html = `
      <a href="/some/page006257.html">令和7年第4回定例会</a>
      <a href="/some/gikaijimukyoku/">令和7年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年");
  });

  it("平成の年度リンクも抽出する", () => {
    const html = `
      <a href="https://www.town.goka.lg.jp/shingi-h31/">平成31年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("平成31年");
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="https://www.town.goka.lg.jp/reiwa6/">令和6年</a>
      <a href="https://www.town.goka.lg.jp/reiwa6/">令和6年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("個別会議ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.goka.lg.jp/gikaijimukyoku/page006257.html">令和7年第4回定例会</a></li>
        <li><a href="https://www.town.goka.lg.jp/gikaijimukyoku/page006177.html">令和7年第3回定例会</a></li>
        <li><a href="https://www.town.goka.lg.jp/gikaijimukyoku/page006025.html">令和7年第1回臨時会</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.title).toBe("令和7年第4回定例会");
    expect(meetings[0]!.url).toBe(
      "https://www.town.goka.lg.jp/gikaijimukyoku/page006257.html",
    );
    expect(meetings[1]!.title).toBe("令和7年第3回定例会");
    expect(meetings[2]!.title).toBe("令和7年第1回臨時会");
  });

  it("定例会・臨時会以外のリンクはスキップする", () => {
    const html = `
      <a href="page006257.html">令和7年第4回定例会</a>
      <a href="page000001.html">お知らせ</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和7年第4回定例会");
  });

  it("相対パスを絶対 URL に変換する", () => {
    const html = `
      <a href="page006257.html">令和7年第4回定例会</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings[0]!.url).toBe(
      "https://www.town.goka.lg.jp/page006257.html",
    );
  });
});

describe("parseMeetingPage", () => {
  it("会議録 PDF リンクを抽出し、審議結果と目次を除外する", () => {
    const html = `
      <h2>審議結果</h2>
      <ul>
        <li><a href="https://www.town.goka.lg.jp/data/doc/1765158813_doc_36_0.pdf">令和7年第4回定例会審議結果 [PDF形式／83.48KB]</a></li>
      </ul>
      <h3>会議録</h3>
      <ul>
        <li><a href="https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_2.pdf">目次 [PDF形式／86.25KB]</a></li>
        <li><a href="https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_0.pdf">第1号 [PDF形式／261.47KB]</a></li>
        <li><a href="https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_1.pdf">第2号 [PDF形式／485.66KB]</a></li>
        <li><a href="https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_3.pdf">第3号 [PDF形式／222.48KB]</a></li>
      </ul>
    `;

    const pdfUrls = parseMeetingPage(html);

    expect(pdfUrls).toHaveLength(3);
    expect(pdfUrls[0]).toBe(
      "https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_0.pdf",
    );
    expect(pdfUrls[1]).toBe(
      "https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_1.pdf",
    );
    expect(pdfUrls[2]).toBe(
      "https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_3.pdf",
    );
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <a href="https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_0.pdf">第1号 [PDF]</a>
      <a href="https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_0.pdf">第1号 [PDF]</a>
    `;

    const pdfUrls = parseMeetingPage(html);
    expect(pdfUrls).toHaveLength(1);
  });

  it("相対パスの PDF リンクを絶対 URL に変換する", () => {
    const html = `
      <a href="/data/doc/1770009974_doc_88_0.pdf">第1号 [PDF]</a>
    `;

    const pdfUrls = parseMeetingPage(html);
    expect(pdfUrls[0]).toBe(
      "https://www.town.goka.lg.jp/data/doc/1770009974_doc_88_0.pdf",
    );
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和7年第4回定例会")).toBe(2025);
  });

  it("令和元年を 2019 に変換する", () => {
    expect(extractYearFromTitle("令和元年第3回定例会")).toBe(2019);
  });

  it("平成31年を 2019 に変換する", () => {
    expect(extractYearFromTitle("平成31年第1回定例会")).toBe(2019);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("お知らせ")).toBeNull();
  });
});
