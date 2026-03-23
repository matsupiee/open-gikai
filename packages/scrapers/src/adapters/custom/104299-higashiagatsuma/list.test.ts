import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseLinkDate } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/www/gikai/contents/1740031692892/index.html">令和7年会議録</a></li>
        <li><a href="/www/gikai/contents/1710227444093/index.html">令和6年会議録</a></li>
        <li><a href="/www/gikai/contents/1686292014524/index.html">令和5年会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.higashiagatsuma.gunma.jp/www/gikai/contents/1740031692892/index.html",
    );
    expect(pages[1]!.label).toBe("令和6年会議録");
    expect(pages[2]!.label).toBe("令和5年会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/www/gikai/contents/1234567890123/index.html">お知らせ</a>
      <a href="/www/gikai/contents/1740031692892/index.html">令和7年会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年会議録");
  });

  it("gikai/contents パターン以外のリンクは無視する", () => {
    const html = `
      <a href="/www/other/contents/1234567890123/index.html">令和7年会議録</a>
      <a href="/www/gikai/contents/1740031692892/index.html">令和7年会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
  });
});

describe("parseLinkDate", () => {
  it("近年形式の定例会をパースする", () => {
    expect(
      parseLinkDate("令和７年第１回（３月）定例会会議録(1954KB)(PDF)"),
    ).toBe("2025-03-01");
  });

  it("近年形式の臨時会をパースする", () => {
    expect(
      parseLinkDate("令和７年第１回（１月）臨時会会議録(403KB)(PDF)"),
    ).toBe("2025-01-01");
  });

  it("近年形式の12月定例会をパースする", () => {
    expect(
      parseLinkDate("令和７年第４回（１２月）定例会会議録(1405KB)(PDF)"),
    ).toBe("2025-12-01");
  });

  it("古い形式の日付をパースする", () => {
    expect(
      parseLinkDate("平成１９年　９月　６日会議録(202KB)(PDF文書)"),
    ).toBe("2007-09-06");
  });

  it("令和元年に対応する", () => {
    expect(
      parseLinkDate("令和元年第１回（３月）定例会会議録(500KB)(PDF)"),
    ).toBe("2019-03-01");
  });

  it("平成元年に対応する", () => {
    expect(
      parseLinkDate("平成元年第１回（３月）定例会会議録(500KB)(PDF)"),
    ).toBe("1989-03-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseLinkDate("目次(8KB)(PDF文書)")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.town.higashiagatsuma.gunma.jp/www/gikai/contents/1740031692892/index.html";

  it("近年形式の PDF リンクを正しく抽出する", () => {
    const html = `
      <h2>ダウンロード</h2>
      <ul>
        <li><a href="/www/gikai/contents/1740031692892/files/rinnjikai0701.pdf">令和７年第１回（１月）臨時会会議録(403KB)(PDF)</a></li>
        <li><a href="/www/gikai/contents/1740031692892/files/teireikai0703.pdf">令和７年第１回（３月）定例会会議録(1954KB)(PDF)</a></li>
        <li><a href="/www/gikai/contents/1740031692892/files/teireikai0706.pdf">令和７年第２回（６月）定例会会議録(1386KB)(PDF)</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.title).toBe("令和７年第１回（１月）臨時会会議録");
    expect(meetings[0]!.heldOn).toBe("2025-01-01");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.higashiagatsuma.gunma.jp/www/gikai/contents/1740031692892/files/rinnjikai0701.pdf",
    );

    expect(meetings[1]!.title).toBe("令和７年第１回（３月）定例会会議録");
    expect(meetings[1]!.heldOn).toBe("2025-03-01");

    expect(meetings[2]!.title).toBe("令和７年第２回（６月）定例会会議録");
    expect(meetings[2]!.heldOn).toBe("2025-06-01");
  });

  it("古い形式の PDF リンクを正しく抽出する", () => {
    const oldPageUrl =
      "https://www.town.higashiagatsuma.gunma.jp/www/gikai/contents/1204214252751/index.html";
    const html = `
      <ul>
        <li><a href="/www/gikai/contents/1204214252751/files/teirei190903_menu.pdf">平成１９年　９月　　　　 目次(8KB)(PDF文書)</a></li>
        <li><a href="/www/gikai/contents/1204214252751/files/teirei190903_01.pdf">平成１９年　９月　６日会議録(202KB)(PDF文書)</a></li>
        <li><a href="/www/gikai/contents/1204214252751/files/teirei190903_02.pdf">平成１９年　９月　７日会議録(97KB)(PDF文書)</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, oldPageUrl);

    // 目次はスキップされる
    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("平成１９年　９月　６日会議録");
    expect(meetings[0]!.heldOn).toBe("2007-09-06");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.higashiagatsuma.gunma.jp/www/gikai/contents/1204214252751/files/teirei190903_01.pdf",
    );

    expect(meetings[1]!.title).toBe("平成１９年　９月　７日会議録");
    expect(meetings[1]!.heldOn).toBe("2007-09-07");
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/www/gikai/contents/1740031692892/files/teireikai0703.pdf">令和７年第１回（３月）定例会会議録(1954KB)(PDF)</a></li>
        <li><a href="/www/gikai/contents/1740031692892/files/other.pdf">資料一覧</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
  });
});
