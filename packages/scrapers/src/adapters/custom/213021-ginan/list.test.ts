import { describe, it, expect } from "vitest";
import { parseYearListPage, parseSessionPage } from "./list";

describe("parseYearListPage", () => {
  it("定例会詳細ページのリンクを抽出する", () => {
    const html = `
      <div class="page-text__text">
        <ul>
          <li><a href="/5440.htm">第1回定例会(3月)会議録</a></li>
          <li><a href="/5566.htm">第2回定例会(6月)会議録</a></li>
          <li><a href="/5683.htm">第3回定例会(10月)会議録</a></li>
          <li><a href="/5801.htm">第4回定例会(12月)会議録</a></li>
        </ul>
      </div>
    `;

    const pages = parseYearListPage(html);

    expect(pages).toHaveLength(4);
    expect(pages[0]!.label).toBe("第1回定例会(3月)会議録");
    expect(pages[0]!.url).toBe("https://www.town.ginan.lg.jp/5440.htm");
    expect(pages[1]!.label).toBe("第2回定例会(6月)会議録");
    expect(pages[1]!.url).toBe("https://www.town.ginan.lg.jp/5566.htm");
    expect(pages[2]!.label).toBe("第3回定例会(10月)会議録");
    expect(pages[3]!.label).toBe("第4回定例会(12月)会議録");
  });

  it("定例会を含まないリンクはスキップする", () => {
    const html = `
      <div>
        <a href="/1234.htm">お知らせ</a>
        <a href="/5440.htm">第1回定例会(3月)会議録</a>
        <a href="/5678.htm">議会だより</a>
      </div>
    `;

    const pages = parseYearListPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("第1回定例会(3月)会議録");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div><p>準備中です</p></div>`;
    const pages = parseYearListPage(html);
    expect(pages).toHaveLength(0);
  });
});

describe("parseSessionPage", () => {
  it("PDF リンクを正しく抽出する", () => {
    const html = `
      <div class="page-text__text">
        <p><a href="/secure/7528/2512mokuji.pdf">〇第4回定例会目次(136KB)</a></p>
        <p><a href="/secure/7528/251128.pdf">〇第4回定例会(第1号)令和7年11月28日(136KB)</a></p>
        <p><a href="/secure/7528/251203.pdf">〇第4回定例会(第2号)令和7年12月3日(191KB)</a></p>
        <p><a href="/secure/7528/251218.pdf">〇第4回定例会(第3号)令和7年12月18日(452KB)</a></p>
      </div>
    `;

    const meetings = parseSessionPage(html, "第4回定例会(12月)");

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe("https://www.town.ginan.lg.jp/secure/7528/251128.pdf");
    expect(meetings[0]!.title).toBe("第4回定例会(12月) 第1号");
    expect(meetings[0]!.heldOn).toBe("2025-11-28");
    expect(meetings[0]!.sessionTitle).toBe("第4回定例会(12月)");

    expect(meetings[1]!.pdfUrl).toBe("https://www.town.ginan.lg.jp/secure/7528/251203.pdf");
    expect(meetings[1]!.title).toBe("第4回定例会(12月) 第2号");
    expect(meetings[1]!.heldOn).toBe("2025-12-03");

    expect(meetings[2]!.pdfUrl).toBe("https://www.town.ginan.lg.jp/secure/7528/251218.pdf");
    expect(meetings[2]!.title).toBe("第4回定例会(12月) 第3号");
    expect(meetings[2]!.heldOn).toBe("2025-12-18");
  });

  it("目次 PDF はスキップする", () => {
    const html = `
      <div>
        <a href="/secure/7528/2512mokuji.pdf">目次(100KB)</a>
        <a href="/secure/7528/251128.pdf">〇第4回定例会(第1号)令和7年11月28日(136KB)</a>
      </div>
    `;

    const meetings = parseSessionPage(html, "第4回定例会(12月)");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-11-28");
  });

  it("旧形式の目次 PDF（mokuji.pdf）もスキップする", () => {
    const html = `
      <div>
        <a href="/secure/4400/mokuji.pdf">目次</a>
        <a href="/secure/4400/teirei1.pdf">〇第3回定例会(第1号)令和3年10月5日(200KB)</a>
      </div>
    `;

    const meetings = parseSessionPage(html, "第3回定例会(10月)");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2021-10-05");
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <div>
        <a href="/secure/7528/251128.pdf">〇第4回定例会(第1号)令和7年11月28日(136KB)</a>
        <a href="/secure/7528/shiryou.pdf">資料一覧</a>
      </div>
    `;

    const meetings = parseSessionPage(html, "第4回定例会(12月)");
    expect(meetings).toHaveLength(1);
  });

  it("/secure/ 以外の PDF はスキップする", () => {
    const html = `
      <div>
        <a href="/other/document.pdf">令和7年11月28日</a>
        <a href="/secure/7528/251128.pdf">〇第4回定例会(第1号)令和7年11月28日(136KB)</a>
      </div>
    `;

    const meetings = parseSessionPage(html, "第4回定例会(12月)");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("/secure/");
  });

  it("絶対 URL のリンクも処理する", () => {
    const html = `
      <div>
        <a href="https://www.town.ginan.lg.jp/secure/7528/251128.pdf">〇第4回定例会(第1号)令和7年11月28日(136KB)</a>
      </div>
    `;

    const meetings = parseSessionPage(html, "第4回定例会(12月)");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe("https://www.town.ginan.lg.jp/secure/7528/251128.pdf");
  });
});
