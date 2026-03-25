import { describe, it, expect } from "vitest";
import { parseIndexPage, parseYearPage, parseHeldOn } from "./list";

describe("parseIndexPage", () => {
  it("年別ページの URL を抽出する", () => {
    const html = `
      <div>
        <a href="/gyousei/choseijoho/gikai/kaigiroku/8342.html">令和6年（2024年）</a>
        <a href="/gyousei/choseijoho/gikai/kaigiroku/7973.html">令和5年（2023年）</a>
        <a href="/gyousei/choseijoho/gikai/kaigiroku/6744.html">令和4年（2022年）</a>
      </div>
    `;

    const results = parseIndexPage(html);

    expect(results).toHaveLength(3);
    expect(results[0]).toBe(
      "https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/8342.html"
    );
    expect(results[1]).toBe(
      "https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/7973.html"
    );
    expect(results[2]).toBe(
      "https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/6744.html"
    );
  });

  it("重複 URL は除去する", () => {
    const html = `
      <a href="/gyousei/choseijoho/gikai/kaigiroku/8342.html">令和6年</a>
      <a href="/gyousei/choseijoho/gikai/kaigiroku/8342.html">令和6年（再掲）</a>
    `;

    const results = parseIndexPage(html);
    expect(results).toHaveLength(1);
  });

  it("年別ページ以外の URL は抽出しない", () => {
    const html = `
      <a href="/gyousei/choseijoho/gikai/index.html">議会トップ</a>
      <a href="/gyousei/choseijoho/gikai/kaigiroku/index.html">インデックス</a>
      <a href="/gyousei/choseijoho/gikai/kaigiroku/8342.html">令和6年</a>
    `;

    const results = parseIndexPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]).toContain("8342.html");
  });

  it("プロトコル相対 URL を含む場合も処理する", () => {
    const html = `
      <a href="//www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/8342.html">令和6年</a>
    `;

    const results = parseIndexPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(
      "https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/8342.html"
    );
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div>会議録はこちら</div>`;
    const results = parseIndexPage(html);
    expect(results).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("h2 見出しと PDF リンクを対応付けて抽出する", () => {
    const html = `
      <h2>3月定例会</h2>
      <p><a href="//www.town.shodoshima.lg.jp/material/files/group/20/R603kaigiroku1.pdf">2月28日 (PDFファイル: 359.1KB)</a></p>
      <p><a href="//www.town.shodoshima.lg.jp/material/files/group/20/R603kaigiroku2.pdf">3月14日 (PDFファイル: 423.3KB)</a></p>

      <h2>6月定例会</h2>
      <p><a href="//www.town.shodoshima.lg.jp/material/files/group/20/kaigiroku_240613.pdf">6月13日 (PDFファイル: 513.9KB)</a></p>
    `;

    const results = parseYearPage(html);

    expect(results).toHaveLength(3);

    expect(results[0]!.sessionType).toBe("3月定例会");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.shodoshima.lg.jp/material/files/group/20/R603kaigiroku1.pdf"
    );
    expect(results[0]!.label).toBe("2月28日 (PDFファイル: 359.1KB)");

    expect(results[1]!.sessionType).toBe("3月定例会");
    expect(results[1]!.pdfUrl).toBe(
      "https://www.town.shodoshima.lg.jp/material/files/group/20/R603kaigiroku2.pdf"
    );

    expect(results[2]!.sessionType).toBe("6月定例会");
    expect(results[2]!.pdfUrl).toBe(
      "https://www.town.shodoshima.lg.jp/material/files/group/20/kaigiroku_240613.pdf"
    );
    expect(results[2]!.label).toBe("6月13日 (PDFファイル: 513.9KB)");
  });

  it("臨時会も抽出する", () => {
    const html = `
      <h2>1月臨時会</h2>
      <p><a href="//www.town.shodoshima.lg.jp/material/files/group/20/rinjikai_20250110.pdf">1月10日 (PDFファイル: 200.0KB)</a></p>
    `;

    const results = parseYearPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.sessionType).toBe("1月臨時会");
  });

  it("h2 見出しの前の PDF リンクは無視する", () => {
    const html = `
      <p><a href="//www.town.shodoshima.lg.jp/material/files/group/20/orphan.pdf">孤立PDF</a></p>
      <h2>3月定例会</h2>
      <p><a href="//www.town.shodoshima.lg.jp/material/files/group/20/R603kaigiroku1.pdf">3月14日</a></p>
    `;

    const results = parseYearPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.sessionType).toBe("3月定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>3月定例会</h2>
      <p>会議録は準備中です。</p>
    `;

    const results = parseYearPage(html);
    expect(results).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクも抽出する", () => {
    const html = `
      <h2>6月定例会</h2>
      <p><a href="https://www.town.shodoshima.lg.jp/material/files/group/20/kaigiroku.pdf">6月13日</a></p>
    `;

    const results = parseYearPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.shodoshima.lg.jp/material/files/group/20/kaigiroku.pdf"
    );
  });
});

describe("parseHeldOn", () => {
  it("ラベルの月日から開催日を生成する", () => {
    expect(parseHeldOn("3月14日 (PDFファイル: 423.3KB)", "3月定例会", 2024)).toBe(
      "2024-03-14"
    );
  });

  it("1桁の月日も正しくパースする", () => {
    expect(parseHeldOn("6月3日 (PDFファイル: 200.0KB)", "6月定例会", 2024)).toBe(
      "2024-06-03"
    );
  });

  it("ラベルに日付がない場合は sessionType から月を推定する", () => {
    expect(parseHeldOn("会議録", "9月定例会", 2024)).toBe("2024-09-01");
  });

  it("日付情報がない場合は null を返す", () => {
    expect(parseHeldOn("会議録", "定例会", 2024)).toBeNull();
  });

  it("2月28日を正しく処理する", () => {
    expect(parseHeldOn("2月28日 (PDFファイル: 359.1KB)", "3月定例会", 2026)).toBe(
      "2026-02-28"
    );
  });
});
