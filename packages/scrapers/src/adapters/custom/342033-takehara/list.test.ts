import { describe, it, expect } from "vitest";
import {
  parseIndexPage,
  parseYearPage,
  parseSectionDate,
  parseSectionStartDate,
  parseDateFromText,
} from "./list";

describe("parseIndexPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gyoseijoho/takeharashigikai/kaiginokekka/2/7828.html">令和7年</a></li>
        <li><a href="/gyoseijoho/takeharashigikai/kaiginokekka/2/7395.html">令和6年</a></li>
        <li><a href="/gyoseijoho/takeharashigikai/kaiginokekka/2/6275.html">令和5年</a></li>
      </ul>
    `;

    const pages = parseIndexPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年");
    expect(pages[0]!.url).toBe(
      "https://www.city.takehara.lg.jp/gyoseijoho/takeharashigikai/kaiginokekka/2/7828.html"
    );
    expect(pages[1]!.label).toBe("令和6年");
    expect(pages[2]!.label).toBe("令和5年");
  });

  it("令和・平成を含まないリンクはスキップする", () => {
    const html = `
      <a href="/gyoseijoho/takeharashigikai/kaiginokekka/2/999.html">お知らせ一覧</a>
      <a href="/gyoseijoho/takeharashigikai/kaiginokekka/2/7828.html">令和7年</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年");
  });

  it(".html なしのリンクにも .html を付与する", () => {
    const html = `
      <a href="/gyoseijoho/takeharashigikai/kaiginokekka/2/7828">令和7年</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.url).toContain(".html");
  });
});

describe("parseSectionDate", () => {
  it("定例会の括弧内の月を取得する", () => {
    expect(parseSectionDate("令和6年第4回定例会（12月10日〜12月20日）")).toBe("2024-12");
  });

  it("臨時会の括弧内の月を取得する", () => {
    expect(parseSectionDate("令和6年第1回臨時会（11月18日）")).toBe("2024-11");
  });

  it("令和元年に対応する", () => {
    expect(parseSectionDate("令和元年第3回定例会（9月10日〜）")).toBe("2019-09");
  });

  it("平成年代のセクション見出しから年月を取得する", () => {
    expect(parseSectionDate("平成30年第3回定例会（9月10日〜）")).toBe("2018-09");
  });

  it("月を含む見出し形式にも対応する", () => {
    expect(parseSectionDate("令和6年12月定例会")).toBe("2024-12");
  });

  it("パースできない場合は null を返す", () => {
    expect(parseSectionDate("資料一覧")).toBeNull();
  });
});

describe("parseSectionStartDate", () => {
  it("定例会の括弧内の開始日を取得する", () => {
    expect(parseSectionStartDate("令和6年第4回定例会（12月10日〜12月20日）")).toBe("2024-12-10");
  });

  it("臨時会の1日開催日を取得する", () => {
    expect(parseSectionStartDate("令和6年第1回臨時会（11月18日）")).toBe("2024-11-18");
  });

  it("括弧なしの場合は null を返す", () => {
    expect(parseSectionStartDate("令和6年第4回定例会")).toBeNull();
  });
});

describe("parseDateFromText", () => {
  it("リンクテキストから同月の日付を取得する", () => {
    expect(parseDateFromText("12月10日", "2024-12")).toBe("2024-12-10");
  });

  it("別月の日付も年を維持して取得する", () => {
    expect(parseDateFromText("3月1日", "2024-03")).toBe("2024-03-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromText("本会議会議録", "2024-12")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.city.takehara.lg.jp/gyoseijoho/takeharashigikai/kaiginokekka/2/7395.html";

  it("セクション見出しと PDF リンクを抽出する", () => {
    const html = `
      <h2>令和6年第4回定例会（12月10日〜12月20日）</h2>
      <ul>
        <li><a href="/material/files/group/20/6-4teireikai1210.pdf">本会議（12月10日）会議録</a></li>
        <li><a href="/material/files/group/20/6-4teireikai1212.pdf">本会議（12月12日）会議録</a></li>
      </ul>
      <h2>令和6年第3回定例会（9月10日〜9月20日）</h2>
      <ul>
        <li><a href="/material/files/group/20/6-3teireikai0910.pdf">本会議（9月10日）会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.heldOn).toBe("2024-12-10");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.takehara.lg.jp/material/files/group/20/6-4teireikai1210.pdf"
    );
    expect(meetings[0]!.section).toBe("令和6年第4回定例会（12月10日〜12月20日）");

    expect(meetings[1]!.heldOn).toBe("2024-12-12");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.city.takehara.lg.jp/material/files/group/20/6-4teireikai1212.pdf"
    );

    expect(meetings[2]!.heldOn).toBe("2024-09-10");
    expect(meetings[2]!.section).toContain("第3回定例会");
  });

  it("臨時会も正しく抽出する", () => {
    const html = `
      <h2>令和6年第1回臨時会（11月18日）</h2>
      <ul>
        <li><a href="/material/files/group/20/6-1rinnji1118.pdf">本会議（11月18日）会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toContain("臨時会");
    expect(meetings[0]!.heldOn).toBe("2024-11-18");
  });

  it("委員会の会議録も抽出する", () => {
    const html = `
      <h2>令和6年第4回定例会（12月10日〜12月20日）</h2>
      <ul>
        <li><a href="/material/files/group/20/6-4teireikai1210.pdf">本会議（12月10日）会議録</a></li>
        <li><a href="/material/files/group/20/6-4soumu1212.pdf">総務文教委員会（12月12日）会議録</a></li>
        <li><a href="/material/files/group/20/6-4minsei1213.pdf">民生都市建設委員会（12月13日）会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(3);
  });

  it("定例会・臨時会の見出しのない PDF リンクはスキップする", () => {
    const html = `
      <h2>会議録について</h2>
      <ul>
        <li><a href="/material/files/group/20/guide.pdf">説明資料</a></li>
      </ul>
      <h2>令和6年第4回定例会（12月10日〜12月20日）</h2>
      <ul>
        <li><a href="/material/files/group/20/6-4teireikai1210.pdf">本会議（12月10日）会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toContain("定例会");
  });

  it("タイトルから PDFファイル情報を除去する", () => {
    const html = `
      <h2>令和6年第4回定例会（12月10日〜12月20日）</h2>
      <ul>
        <li><a href="/material/files/group/20/6-4teireikai1210.pdf">本会議（12月10日）会議録 [PDFファイル／500KB]</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings[0]!.title).not.toContain("[PDFファイル");
    expect(meetings[0]!.title).toContain("会議録");
  });

  it("h3 見出しのページにも対応する", () => {
    const html = `
      <h3>令和6年第4回定例会（12月10日〜12月20日）</h3>
      <ul>
        <li><a href="/material/files/group/20/6-4teireikai1210.pdf">本会議会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
  });

  it("PDF のない年度ページは空配列を返す", () => {
    const html = `
      <h2>令和6年第4回定例会（12月10日〜12月20日）</h2>
      <p>会議録は現在準備中です。</p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(0);
  });
});
