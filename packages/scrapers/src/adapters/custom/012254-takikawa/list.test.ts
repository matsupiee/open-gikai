import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage } from "./list";
import { extractYearFromTitle, extractMonthDay, buildDateString } from "./shared";

describe("parseTopPage", () => {
  it("和暦年度テキストを持つ /page/{ID}.html リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/page/18437.html">令和7年</a></li>
        <li><a href="/page/13367.html">令和6年</a></li>
        <li><a href="/page/2998.html">令和5年</a></li>
      </ul>
    `;

    const results = parseTopPage(html);

    expect(results).toHaveLength(3);
    expect(results[0]!.pageId).toBe("18437");
    expect(results[0]!.url).toBe("https://www.city.takikawa.lg.jp/page/18437.html");
    expect(results[0]!.linkText).toBe("令和7年");
    expect(results[1]!.pageId).toBe("13367");
    expect(results[2]!.pageId).toBe("2998");
  });

  it("トップページ自身 (2872) は除外する", () => {
    const html = `
      <a href="/page/2872.html">会議録トップ</a>
      <a href="/page/18437.html">令和7年</a>
    `;

    const results = parseTopPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.pageId).toBe("18437");
  });

  it("和暦年度テキストを持たないリンクは除外する", () => {
    const html = `
      <a href="/page/1368.html">市内バス路線のご案内</a>
      <a href="/page/18437.html">令和7年</a>
    `;

    const results = parseTopPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.pageId).toBe("18437");
  });

  it("テキストが長い場合は除外する（年度以外のリンク）", () => {
    const html = `
      <a href="/page/16918.html">滝川市職員候補者登録試験の実施について　令和8年7月採用　一般職</a>
      <a href="/page/18437.html">令和7年</a>
    `;

    const results = parseTopPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.pageId).toBe("18437");
  });

  it("重複する pageId は除外する", () => {
    const html = `
      <a href="/page/18437.html">令和7年</a>
      <a href="/page/18437.html">令和7年</a>
    `;

    const results = parseTopPage(html);
    expect(results).toHaveLength(1);
  });

  it("/page/ リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const results = parseTopPage(html);
    expect(results).toHaveLength(0);
  });

  it("絶対 URL の /page/ リンクも抽出する", () => {
    const html = `
      <a href="https://www.city.takikawa.lg.jp/page/18437.html">令和7年</a>
    `;

    const results = parseTopPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.pageId).toBe("18437");
    expect(results[0]!.url).toBe("https://www.city.takikawa.lg.jp/page/18437.html");
  });

  it("平成年度のリンクも抽出する", () => {
    const html = `
      <a href="/page/2871.html">平成16年～令和元年</a>
    `;

    const results = parseTopPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.pageId).toBe("2871");
    expect(results[0]!.linkText).toBe("平成16年～令和元年");
  });
});

describe("parseYearPage", () => {
  it("PDF リンクと会議情報を抽出する", () => {
    const html = `
      <h2>第4回定例会</h2>
      <ul>
        <li><a href="/uploaded/attachment/18555.pdf">目次 [PDFファイル／55KB]</a></li>
        <li><a href="/uploaded/attachment/18556.pdf">12月3日 [PDFファイル／350KB]</a></li>
        <li><a href="/uploaded/attachment/18557.pdf">12月9日 [PDFファイル／280KB]</a></li>
      </ul>
    `;

    const results = parseYearPage(html, "18437", 2025);

    expect(results).toHaveLength(3);
    expect(results[0]!.attachmentId).toBe("18555");
    expect(results[0]!.isIndex).toBe(true);
    expect(results[0]!.heldOn).toBeNull();

    expect(results[1]!.attachmentId).toBe("18556");
    expect(results[1]!.isIndex).toBe(false);
    expect(results[1]!.heldOn).toBe("2025-12-03");
    expect(results[1]!.pdfUrl).toBe(
      "https://www.city.takikawa.lg.jp/uploaded/attachment/18556.pdf"
    );

    expect(results[2]!.attachmentId).toBe("18557");
    expect(results[2]!.heldOn).toBe("2025-12-09");
  });

  it("h2 見出しがない場合もページ全体を処理する", () => {
    const html = `
      <ul>
        <li><a href="/uploaded/attachment/12345.pdf">3月10日 [PDFファイル／200KB]</a></li>
      </ul>
    `;

    const results = parseYearPage(html, "99999", 2024);

    expect(results).toHaveLength(1);
    expect(results[0]!.attachmentId).toBe("12345");
    expect(results[0]!.heldOn).toBe("2024-03-10");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>PDF なし</p></body></html>`;

    const results = parseYearPage(html, "99999", 2024);
    expect(results).toHaveLength(0);
  });

  it("タイトルに h2 見出しと日付が含まれる", () => {
    const html = `
      <h2>第1回臨時会</h2>
      <ul>
        <li><a href="/uploaded/attachment/20000.pdf">5月15日 [PDFファイル／150KB]</a></li>
      </ul>
    `;

    const results = parseYearPage(html, "12345", 2025);

    expect(results[0]!.title).toContain("第1回臨時会");
    expect(results[0]!.title).toContain("2025年");
  });

  it("複数の h2 セクションを処理する", () => {
    const html = `
      <h2>第1回定例会</h2>
      <ul>
        <li><a href="/uploaded/attachment/10001.pdf">3月5日 [PDFファイル／200KB]</a></li>
      </ul>
      <h2>第2回定例会</h2>
      <ul>
        <li><a href="/uploaded/attachment/10002.pdf">6月10日 [PDFファイル／180KB]</a></li>
        <li><a href="/uploaded/attachment/10003.pdf">6月11日 [PDFファイル／220KB]</a></li>
      </ul>
    `;

    const results = parseYearPage(html, "12345", 2025);

    expect(results).toHaveLength(3);
    expect(results[0]!.heldOn).toBe("2025-03-05");
    expect(results[1]!.heldOn).toBe("2025-06-10");
    expect(results[2]!.heldOn).toBe("2025-06-11");
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和7年 本会議")).toBe(2025);
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearFromTitle("令和元年 会議録")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromTitle("平成16年 本会議")).toBe(2004);
  });

  it("全角数字を正しく変換する", () => {
    expect(extractYearFromTitle("令和８年")).toBe(2026);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});

describe("extractMonthDay", () => {
  it("月日を抽出する", () => {
    expect(extractMonthDay("12月3日 [PDFファイル／350KB]")).toEqual({ month: 12, day: 3 });
  });

  it("全角数字の月日を抽出する", () => {
    expect(extractMonthDay("１２月３日")).toEqual({ month: 12, day: 3 });
  });

  it("月日がない場合は null を返す", () => {
    expect(extractMonthDay("目次 [PDFファイル／55KB]")).toBeNull();
  });
});

describe("buildDateString", () => {
  it("年月日から YYYY-MM-DD を生成する", () => {
    expect(buildDateString(2025, 12, 3)).toBe("2025-12-03");
  });

  it("1桁の月日をゼロパディングする", () => {
    expect(buildDateString(2024, 3, 5)).toBe("2024-03-05");
  });
});
