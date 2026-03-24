import { describe, expect, it } from "vitest";
import { parseMeetingPage, parseTopPage, parseYearIndexPage } from "./list";

describe("parseTopPage", () => {
  it("トップページから直下の年号ディレクトリを抽出する", () => {
    const html = `
      <div>
        <a href="/shisei/12/7/R8/index.html">令和8年</a>
        <a href="/shisei/12/7/R7_1/index.html">令和7年</a>
      </div>
    `;

    const dirs = parseTopPage(html);

    expect(dirs).toContain("R8");
    expect(dirs).toContain("R7_1");
    expect(dirs).not.toContain("kako-kaigikekka");
  });

  it("kako-kaigikekka 配下の年号ディレクトリを抽出する", () => {
    const html = `
      <div>
        <a href="/shisei/12/7/kako-kaigikekka/R6_1/index.html">令和6年</a>
        <a href="/shisei/12/7/kako-kaigikekka/R5_1/index.html">令和5年</a>
        <a href="/shisei/12/7/kako-kaigikekka/reiwa4/index.html">令和4年</a>
        <a href="/shisei/12/7/kako-kaigikekka/H31/index.html">平成31年</a>
      </div>
    `;

    const dirs = parseTopPage(html);

    expect(dirs).toContain("kako-kaigikekka/R6_1");
    expect(dirs).toContain("kako-kaigikekka/R5_1");
    expect(dirs).toContain("kako-kaigikekka/reiwa4");
    expect(dirs).toContain("kako-kaigikekka/H31");
  });

  it("重複するディレクトリは除外する", () => {
    const html = `
      <a href="/shisei/12/7/R8/index.html">令和8年 一覧</a>
      <a href="/shisei/12/7/R8/index.html">令和8年 会議録</a>
    `;

    const dirs = parseTopPage(html);

    expect(dirs.filter((d) => d === "R8")).toHaveLength(1);
  });

  it("最新年度と過去年度を両方抽出する", () => {
    const html = `
      <a href="/shisei/12/7/R8/index.html">令和8年</a>
      <a href="/shisei/12/7/R7_1/index.html">令和7年</a>
      <a href="/shisei/12/7/kako-kaigikekka/R6_1/index.html">令和6年</a>
      <a href="/shisei/12/7/kako-kaigikekka/H30/index.html">平成30年</a>
    `;

    const dirs = parseTopPage(html);

    expect(dirs).toHaveLength(4);
    expect(dirs[0]).toBe("R8");
    expect(dirs[1]).toBe("R7_1");
    expect(dirs[2]).toBe("kako-kaigikekka/R6_1");
    expect(dirs[3]).toBe("kako-kaigikekka/H30");
  });
});

describe("parseYearIndexPage", () => {
  it("年度インデックスから会議詳細ページリンクを抽出する", () => {
    const html = `
      <div>
        <a href="/shisei/12/7/R7_1/12345.html">令和7年第1回臨時会</a>
        <a href="/shisei/12/7/R7_1/12346.html">令和7年第2回定例会</a>
        <a href="/shisei/12/7/R7_1/12347.html">令和7年第3回定例会</a>
      </div>
    `;

    const pages = parseYearIndexPage(
      html,
      "https://www.city.yame.fukuoka.jp/shisei/12/7/R7_1/index.html",
    );

    expect(pages).toHaveLength(3);
    expect(pages[0]!.title).toBe("令和7年第1回臨時会");
    expect(pages[0]!.pageUrl).toBe(
      "https://www.city.yame.fukuoka.jp/shisei/12/7/R7_1/12345.html",
    );
    expect(pages[1]!.title).toBe("令和7年第2回定例会");
  });

  it("定例会・臨時会・委員会に関連しないリンクはスキップする", () => {
    const html = `
      <a href="/shisei/12/7/R7_1/12345.html">令和7年第1回定例会</a>
      <a href="/shisei/12/7/R7_1/12340.html">お知らせ</a>
      <a href="/shisei/12/7/index.html">議会トップ</a>
    `;

    const pages = parseYearIndexPage(
      html,
      "https://www.city.yame.fukuoka.jp/shisei/12/7/R7_1/index.html",
    );

    expect(pages).toHaveLength(1);
    expect(pages[0]!.title).toBe("令和7年第1回定例会");
  });

  it("重複するページ URL は除外する", () => {
    const html = `
      <a href="/shisei/12/7/R7_1/12345.html">令和7年第1回定例会</a>
      <a href="/shisei/12/7/R7_1/12345.html">令和7年第1回定例会（再掲）</a>
    `;

    const pages = parseYearIndexPage(
      html,
      "https://www.city.yame.fukuoka.jp/shisei/12/7/R7_1/index.html",
    );

    expect(pages).toHaveLength(1);
  });
});

describe("parseMeetingPage", () => {
  it("会議詳細ページから会議録 PDF リンクを抽出する", () => {
    const html = `
      <div>
        <a href="/shisei/12/7/R7_1/files/R070124.pdf">
          令和7年1月24日 会議録 (PDFファイル: 258.6KB)
        </a>
      </div>
    `;

    const meetings = parseMeetingPage(
      html,
      "令和7年第1回臨時会",
      "https://www.city.yame.fukuoka.jp/shisei/12/7/R7_1/12345.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.yame.fukuoka.jp/shisei/12/7/R7_1/files/R070124.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2025-01-24");
    expect(meetings[0]!.title).toBe("令和7年第1回臨時会");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("会期日程と議決結果一覧は除外する", () => {
    const html = `
      <a href="/files/kaikei.pdf">令和7年1月24日 会期日程 (PDFファイル: 58.6KB)</a>
      <a href="/files/giketsukekka.pdf">令和7年1月24日 議決結果一覧表 (PDFファイル: 61.6KB)</a>
      <a href="/files/R070124.pdf">令和7年1月24日 会議録 (PDFファイル: 258.6KB)</a>
    `;

    const meetings = parseMeetingPage(
      html,
      "令和7年第1回臨時会",
      "https://www.city.yame.fukuoka.jp/shisei/12/7/R7_1/12345.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("R070124.pdf");
  });

  it("複数の開催日の PDF を抽出する", () => {
    const html = `
      <a href="/files/R060304.pdf">令和6年3月4日 会議録 (PDFファイル: 761.5KB)</a>
      <a href="/files/R060305.pdf">令和6年3月5日 会議録 (PDFファイル: 462.7KB)</a>
      <a href="/files/R060321.pdf">令和6年3月21日 会議録 (PDFファイル: 316.8KB)</a>
    `;

    const meetings = parseMeetingPage(
      html,
      "令和6年第2回定例会",
      "https://www.city.yame.fukuoka.jp/shisei/12/7/kako-kaigikekka/R6_1/12300.html",
    );

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2024-03-04");
    expect(meetings[1]!.heldOn).toBe("2024-03-05");
    expect(meetings[2]!.heldOn).toBe("2024-03-21");
    expect(meetings[0]!.meetingType).toBe("plenary");
  });

  it("日付を含まない PDF リンクはスキップする", () => {
    const html = `
      <a href="/files/R070124.pdf">令和7年1月24日 会議録 (PDFファイル: 258.6KB)</a>
      <a href="/files/shiryo.pdf">参考資料 (PDFファイル: 100KB)</a>
    `;

    const meetings = parseMeetingPage(
      html,
      "令和7年第1回臨時会",
      "https://example.com/12345.html",
    );

    expect(meetings).toHaveLength(1);
  });

  it("平成年号の日付も正しく解析する", () => {
    const html = `
      <a href="/files/H310124.pdf">平成31年1月24日 会議録 (PDFファイル: 200KB)</a>
    `;

    const meetings = parseMeetingPage(
      html,
      "平成31年第1回臨時会",
      "https://www.city.yame.fukuoka.jp/shisei/12/7/kako-kaigikekka/H31/11000.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-01-24");
  });

  it("protocol-relative URL を正しく処理する", () => {
    const html = `
      <a href="//www.city.yame.fukuoka.jp/files/R070124.pdf">令和7年1月24日 会議録</a>
    `;

    const meetings = parseMeetingPage(
      html,
      "令和7年第1回臨時会",
      "https://www.city.yame.fukuoka.jp/shisei/12/7/R7_1/12345.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.yame.fukuoka.jp/files/R070124.pdf",
    );
  });
});
