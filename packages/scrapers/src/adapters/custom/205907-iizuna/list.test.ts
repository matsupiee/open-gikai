import { describe, expect, it } from "vitest";
import { parseDetailPageForPdf, parseHeldOnFromTitle, parseListPage } from "./list";

describe("parseListPage", () => {
  it("h2 > a タグから会議録リンクを抽出する", () => {
    const html = `
      <h2><a href="/docs/13282.html">令和7年12月定例会 会議録</a></h2>
      <h2><a href="/docs/13544.html">令和8年第1回（1月16日）臨時会　会議録</a></h2>
      <h2><a href="/docs/11454.html">令和6年12月定例会 会議録</a></h2>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.detailUrl).toBe(
      "https://www.town.iizuna.nagano.jp/docs/13282.html"
    );
    expect(meetings[0]!.title).toBe("令和7年12月定例会 会議録");
    expect(meetings[0]!.year).toBe(2025);

    expect(meetings[1]!.detailUrl).toBe(
      "https://www.town.iizuna.nagano.jp/docs/13544.html"
    );
    expect(meetings[1]!.title).toBe("令和8年第1回（1月16日）臨時会　会議録");
    expect(meetings[1]!.year).toBe(2026);

    expect(meetings[2]!.detailUrl).toBe(
      "https://www.town.iizuna.nagano.jp/docs/11454.html"
    );
    expect(meetings[2]!.title).toBe("令和6年12月定例会 会議録");
    expect(meetings[2]!.year).toBe(2024);
  });

  it("全角数字を含むタイトルも正しく年を抽出する", () => {
    const html = `
      <h2><a href="/docs/10000.html">令和４年６月定例会 会議録</a></h2>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2022);
    // 元のタイトルは全角のまま保持
    expect(meetings[0]!.title).toBe("令和４年６月定例会 会議録");
  });

  it("平成の会議録も正しくパースする", () => {
    const html = `
      <h2><a href="/docs/5000.html">平成29年3月定例会 会議録</a></h2>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2017);
  });

  it("令和元年をパースする", () => {
    const html = `
      <h2><a href="/docs/7000.html">令和元年9月定例会 会議録</a></h2>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2019);
  });

  it("h2 以外のリンクはスキップする", () => {
    const html = `
      <h3><a href="/docs/9999.html">お知らせ</a></h3>
      <h2><a href="/docs/13282.html">令和7年12月定例会 会議録</a></h2>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("")).toEqual([]);
  });
});

describe("parseDetailPageForPdf", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <a href="/fs/8/5/8/8/7/_/___.pdf">会議録 (PDF 1.2MB)</a>
    `;

    const pdfUrl = parseDetailPageForPdf(html);
    expect(pdfUrl).toBe(
      "https://www.town.iizuna.nagano.jp/fs/8/5/8/8/7/_/___.pdf"
    );
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `<p>会議録はありません。</p>`;
    expect(parseDetailPageForPdf(html)).toBeNull();
  });
});

describe("parseHeldOnFromTitle", () => {
  it("定例会タイトルから日付を抽出する（月の1日をデフォルト）", () => {
    expect(parseHeldOnFromTitle("令和7年12月定例会 会議録")).toBe("2025-12-01");
  });

  it("臨時会タイトルから日付を抽出する", () => {
    expect(
      parseHeldOnFromTitle("令和8年第1回（1月16日）臨時会　会議録")
    ).toBe("2026-01-16");
  });

  it("全角数字を含むタイトルも正しくパースする", () => {
    expect(parseHeldOnFromTitle("令和４年６月定例会 会議録")).toBe("2022-06-01");
  });

  it("令和元年の定例会", () => {
    expect(parseHeldOnFromTitle("令和元年9月定例会 会議録")).toBe("2019-09-01");
  });

  it("パースできない場合は null を返す", () => {
    expect(parseHeldOnFromTitle("議事日程")).toBeNull();
  });
});
