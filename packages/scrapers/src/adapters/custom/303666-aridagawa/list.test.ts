import { describe, it, expect } from "vitest";
import { parseIndexPage, parseYearPage } from "./list";
import { parsePdfFilename } from "./shared";

describe("parsePdfFilename", () => {
  it("令和の定例会 PDF ファイル名を解析する", () => {
    const result = parsePdfFilename("R6-4-1teireiR061203.pdf");
    expect(result).not.toBeNull();
    expect(result!.eraYear).toBe(6);
    expect(result!.session).toBe(4);
    expect(result!.dayNumber).toBe(1);
    expect(result!.meetingKind).toBe("teirei");
    expect(result!.heldOn).toBe("2024-12-03");
  });

  it("令和の臨時会 PDF ファイル名を解析する", () => {
    const result = parsePdfFilename("R07-3-1rinjiR070624.pdf");
    expect(result).not.toBeNull();
    expect(result!.eraYear).toBe(7);
    expect(result!.session).toBe(3);
    expect(result!.dayNumber).toBe(1);
    expect(result!.meetingKind).toBe("rinji");
    expect(result!.heldOn).toBe("2025-06-24");
  });

  it("年度が0埋めされていない場合も解析する", () => {
    const result = parsePdfFilename("R7-2-2teireiR070612.pdf");
    expect(result).not.toBeNull();
    expect(result!.eraYear).toBe(7);
    expect(result!.session).toBe(2);
    expect(result!.dayNumber).toBe(2);
    expect(result!.heldOn).toBe("2025-06-12");
  });

  it("不正なファイル名は null を返す", () => {
    expect(parsePdfFilename("readme.pdf")).toBeNull();
    expect(parsePdfFilename("R7-2-1teirei.pdf")).toBeNull();
    expect(parsePdfFilename("something.txt")).toBeNull();
  });
});

const INDEX_HTML = `
<div>
  <ul>
    <li><a href="https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/9452.html">令和7年 本会議会議録</a></li>
    <li><a href="https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/8884.html">令和6年 本会議会議録</a></li>
    <li><a href="https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/8338.html">令和5年 本会議会議録</a></li>
    <li><a href="https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/7387.html">令和元年（平成31年） 本会議会議録</a></li>
    <li><a href="https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/7390.html">平成30年 本会議会議録</a></li>
    <li><a href="https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/7426.html">平成18年 本会議会議録</a></li>
  </ul>
</div>
`;

describe("parseIndexPage", () => {
  it("令和7年のページ URL を抽出する", () => {
    const result = parseIndexPage(INDEX_HTML);
    const r7 = result.find((p) => p.year === 2025);
    expect(r7).not.toBeUndefined();
    expect(r7!.url).toBe(
      "https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/9452.html"
    );
  });

  it("令和6年のページ URL を抽出する", () => {
    const result = parseIndexPage(INDEX_HTML);
    const r6 = result.find((p) => p.year === 2024);
    expect(r6).not.toBeUndefined();
    expect(r6!.url).toBe(
      "https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/8884.html"
    );
  });

  it("令和元年を正しく西暦2019に変換する", () => {
    const result = parseIndexPage(INDEX_HTML);
    const r1 = result.find((p) => p.year === 2019);
    expect(r1).not.toBeUndefined();
    expect(r1!.url).toBe(
      "https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/7387.html"
    );
  });

  it("平成30年を正しく西暦2018に変換する", () => {
    const result = parseIndexPage(INDEX_HTML);
    const h30 = result.find((p) => p.year === 2018);
    expect(h30).not.toBeUndefined();
    expect(h30!.url).toBe(
      "https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/7390.html"
    );
  });

  it("平成18年を正しく西暦2006に変換する", () => {
    const result = parseIndexPage(INDEX_HTML);
    const h18 = result.find((p) => p.year === 2006);
    expect(h18).not.toBeUndefined();
    expect(h18!.url).toBe(
      "https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/7426.html"
    );
  });

  it("全リンクを抽出する", () => {
    const result = parseIndexPage(INDEX_HTML);
    expect(result.length).toBe(6);
  });
});

const YEAR_PAGE_HTML = `
<h2>令和7年第3回臨時会（令和7年6月24日）</h2>
<p>
  <a href="//www.town.aridagawa.lg.jp/material/files/group/12/R07-3-1rinjiR070624.pdf">
    令和7年6月24日本会議会議録 (PDFファイル: 170.8KB)
  </a>
</p>
<h2>令和7年第2回定例会（令和7年6月3日～17日）</h2>
<p>
  <a href="//www.town.aridagawa.lg.jp/material/files/group/12/R7-2-1teireiR070603.pdf">
    令和7年6月3日本会議会議録 (PDFファイル: 174.7KB)
  </a>
</p>
<p>
  <a href="//www.town.aridagawa.lg.jp/material/files/group/12/R7-2-2teireiR070612.pdf">
    令和7年6月12日本会議会議録 (PDFファイル: 613.6KB)
  </a>
</p>
<p>
  <a href="//www.town.aridagawa.lg.jp/material/files/group/12/R7-2-3teireiR070617.pdf">
    令和7年6月17日本会議会議録 (PDFファイル: 277.7KB)
  </a>
</p>
<h2>令和7年第1回定例会（令和7年3月4日～25日）</h2>
<p>
  <a href="//www.town.aridagawa.lg.jp/material/files/group/12/R7-1-1teireiR070304.pdf">
    令和7年3月4日本会議会議録 (PDFファイル: 269.2KB)
  </a>
</p>
`;

describe("parseYearPage", () => {
  it("臨時会の PDF を抽出する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    const rinji = result.find((m) => m.meetingType === "extraordinary");
    expect(rinji).not.toBeUndefined();
    expect(rinji!.pdfUrl).toBe(
      "https://www.town.aridagawa.lg.jp/material/files/group/12/R07-3-1rinjiR070624.pdf"
    );
    expect(rinji!.heldOn).toBe("2025-06-24");
    expect(rinji!.title).toBe("第3回臨時会 第1日");
  });

  it("定例会の複数日分を抽出する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    const session2 = result.filter((m) => m.title.startsWith("第2回定例会"));
    expect(session2.length).toBe(3);

    expect(session2[0]!.heldOn).toBe("2025-06-03");
    expect(session2[0]!.title).toBe("第2回定例会 第1日");
    expect(session2[0]!.meetingType).toBe("plenary");

    expect(session2[1]!.heldOn).toBe("2025-06-12");
    expect(session2[1]!.title).toBe("第2回定例会 第2日");

    expect(session2[2]!.heldOn).toBe("2025-06-17");
    expect(session2[2]!.title).toBe("第2回定例会 第3日");
  });

  it("全件を抽出する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    expect(result.length).toBe(5);
  });

  it("protocol-relative URL を https に変換する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    for (const m of result) {
      expect(m.pdfUrl).toMatch(/^https:\/\//);
    }
  });
});
