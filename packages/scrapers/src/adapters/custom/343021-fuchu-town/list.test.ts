import { describe, it, expect } from "vitest";
import { parseYearPage, parseDetailPage, extractYearFromTitle } from "./list";
import { parseDateText } from "./shared";

describe("parseDateText", () => {
  it("令和の全角数字日付をパースする", () => {
    expect(parseDateText("令和７年１２月１２日（金）")).toBe("2025-12-12");
  });

  it("令和の半角数字日付をパースする", () => {
    expect(parseDateText("令和7年12月12日（金）")).toBe("2025-12-12");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("平成30年3月5日（月）")).toBe("2018-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("資料一覧")).toBeNull();
  });

  it("月日が1桁の場合にゼロ埋めする", () => {
    expect(parseDateText("令和6年3月5日")).toBe("2024-03-05");
  });
});

describe("extractYearFromTitle", () => {
  it("令和の全角数字タイトルから西暦年を抽出する", () => {
    expect(extractYearFromTitle("令和７年第５回府中町議会定例会")).toBe(2025);
  });

  it("平成のタイトルから西暦年を抽出する", () => {
    expect(extractYearFromTitle("平成30年第1回府中町議会定例会")).toBe(2018);
  });

  it("年号がない場合は null を返す", () => {
    expect(extractYearFromTitle("お知らせ")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("会議別詳細ページへのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/assembly/12345.html">令和７年第５回府中町議会定例会</a></li>
        <li><a href="/site/assembly/12346.html">令和７年第４回府中町議会定例会</a></li>
        <li><a href="/site/assembly/12347.html">令和７年第１回府中町議会臨時会</a></li>
      </ul>
    `;

    const pages = parseYearPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和７年第５回府中町議会定例会");
    expect(pages[0]!.url).toBe(
      "https://www.town.fuchu.hiroshima.jp/site/assembly/12345.html"
    );
    expect(pages[1]!.label).toBe("令和７年第４回府中町議会定例会");
    expect(pages[2]!.label).toBe("令和７年第１回府中町議会臨時会");
  });

  it("list158 ページへのリンクはスキップする", () => {
    const html = `
      <a href="/site/assembly/list158-1604.html">令和7年</a>
      <a href="/site/assembly/12345.html">令和７年第５回府中町議会定例会</a>
    `;

    const pages = parseYearPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和７年第５回府中町議会定例会");
  });

  it("議会を含まないリンクはスキップする", () => {
    const html = `
      <a href="/site/assembly/99999.html">お知らせ</a>
      <a href="/site/assembly/12345.html">令和７年第５回府中町議会定例会</a>
    `;

    const pages = parseYearPage(html);
    expect(pages).toHaveLength(1);
  });
});

describe("parseDetailPage", () => {
  it("本文 PDF リンクを抽出し目録をスキップする", () => {
    const html = `
      <ul>
        <li><a href="/uploaded/attachment/31535.pdf">会議録（第1号）目録（12月12日） [PDFファイル／161KB]</a></li>
        <li><a href="/uploaded/attachment/31536.pdf">会議録（第1号）本文（12月12日） [PDFファイル／821KB]</a></li>
        <li><a href="/uploaded/attachment/31537.pdf">会議録（第2号）目録（12月15日） [PDFファイル／150KB]</a></li>
        <li><a href="/uploaded/attachment/31538.pdf">会議録（第2号）本文（12月15日） [PDFファイル／700KB]</a></li>
      </ul>
    `;

    const meetings = parseDetailPage(
      html,
      "令和７年第５回府中町議会定例会",
      "https://www.town.fuchu.hiroshima.jp/site/assembly/12345.html"
    );

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.fuchu.hiroshima.jp/uploaded/attachment/31536.pdf"
    );
    expect(meetings[0]!.title).toBe("令和７年第５回府中町議会定例会 第1号");
    expect(meetings[0]!.heldOn).toBe("2025-12-12");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.fuchu.hiroshima.jp/uploaded/attachment/31538.pdf"
    );
    expect(meetings[1]!.title).toBe("令和７年第５回府中町議会定例会 第2号");
    expect(meetings[1]!.heldOn).toBe("2025-12-15");
  });

  it("本文リンクがない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="/uploaded/attachment/31535.pdf">会議録（第1号）目録（12月12日） [PDFファイル／161KB]</a></li>
      </ul>
    `;

    const meetings = parseDetailPage(
      html,
      "令和７年第５回府中町議会定例会",
      "https://www.town.fuchu.hiroshima.jp/site/assembly/12345.html"
    );

    expect(meetings).toHaveLength(0);
  });

  it("PDF リンクがないページは空配列を返す", () => {
    const html = `<div><p>会議録は準備中です。</p></div>`;

    const meetings = parseDetailPage(
      html,
      "令和７年第５回府中町議会定例会",
      "https://www.town.fuchu.hiroshima.jp/site/assembly/12345.html"
    );

    expect(meetings).toHaveLength(0);
  });
});
