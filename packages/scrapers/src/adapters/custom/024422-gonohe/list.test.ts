import { describe, expect, it } from "vitest";
import { parseDateText, parseLinkMeta, parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <div class="main_box">
        <h1>議会会議録</h1>
        <div class="main_body2">
          <h2><a href="2025-0602-1755-70.html">令和7年</a></h2>
          <p>　　第1回～第3回</p>
          <h2><a href="2024-0105-1410-70.html">令和6年</a></h2>
          <p>　　第34回～第38回</p>
          <h2><a href="gikai_kaigiroku_H28.html">平成28年</a></h2>
          <p>　　第1回～第5回</p>
        </div>
      </div>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年");
    expect(pages[0]!.url).toBe(
      "https://www.town.gonohe.aomori.jp/chosei/gikai/2025-0602-1755-70.html",
    );
    expect(pages[1]!.label).toBe("令和6年");
    expect(pages[1]!.url).toBe(
      "https://www.town.gonohe.aomori.jp/chosei/gikai/2024-0105-1410-70.html",
    );
    expect(pages[2]!.label).toBe("平成28年");
    expect(pages[2]!.url).toBe(
      "https://www.town.gonohe.aomori.jp/chosei/gikai/gikai_kaigiroku_H28.html",
    );
  });

  it("絶対パスのリンクも処理する", () => {
    const html = `
      <h2><a href="/chosei/gikai/2025-0602-1755-70.html">令和7年</a></h2>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.url).toBe(
      "https://www.town.gonohe.aomori.jp/chosei/gikai/2025-0602-1755-70.html",
    );
  });

  it("span でラップされたラベルも抽出する", () => {
    const html = `
      <h2 class="main_box_h2">
	<a href="2025-0602-1755-70.html" target="_blank"><span class="text_blue">令和7年</span></a></h2>
      <h2 class="main_box_h2">
	<a href="2024-0105-1410-70.html"><span style="color:#0000cd;">令和6年</span></a></h2>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.label).toBe("令和7年");
    expect(pages[1]!.label).toBe("令和6年");
  });

  it("h2 以外のリンクは無視する", () => {
    const html = `
      <p><a href="some-other-page.html">関連リンク</a></p>
      <h2><a href="2025-0602-1755-70.html">令和7年</a></h2>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
  });
});

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("第1回 定例会　令和7年8月28日")).toBe("2025-08-28");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("第1回 定例会　平成24年3月8日")).toBe("2012-03-08");
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("第1回 定例会　令和元年6月13日")).toBe("2019-06-13");
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("第1回 定例会　平成元年3月5日")).toBe("1989-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("議事日程")).toBeNull();
  });
});

describe("parseLinkMeta", () => {
  it("定例会のメタデータを抽出する", () => {
    const result = parseLinkMeta("第1回 定例会　令和7年8月28日");

    expect(result).not.toBeNull();
    expect(result!.session).toBe("第1回");
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.heldOn).toBe("2025-08-28");
  });

  it("臨時会のメタデータを抽出する", () => {
    const result = parseLinkMeta("第5回 臨時会　令和5年11月15日");

    expect(result).not.toBeNull();
    expect(result!.meetingKind).toBe("臨時会");
  });

  it("日付なしの場合は null を返す", () => {
    expect(parseLinkMeta("議事日程")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.town.gonohe.aomori.jp/chosei/gikai/2025-0602-1755-70.html";

  it("PDF リンクとメタデータを抽出する", () => {
    const html = `
      <div class="main_box">
        <h1>議会会議録　令和7年</h1>
        <div class="main_body2">
          <p><a href="./gonohe-gikai-kaigiroku18-1.pdf">第1回 定例会　令和7年8月28日<img class="wcv_ww_fileicon" alt="PDFファイル"><span class="wcv_ww_filesize">(300KB)</span></a></p>
          <p><a href="./gonohe-gikai-kaigiroku18-2.pdf">第2回 定例会　令和7年9月3日<img class="wcv_ww_fileicon" alt="PDFファイル"><span class="wcv_ww_filesize">(450KB)</span></a></p>
        </div>
      </div>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.gonohe.aomori.jp/chosei/gikai/gonohe-gikai-kaigiroku18-1.pdf",
    );
    expect(meetings[0]!.title).toBe("定例会 第1回");
    expect(meetings[0]!.heldOn).toBe("2025-08-28");
    expect(meetings[0]!.section).toBe("定例会");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.gonohe.aomori.jp/chosei/gikai/gonohe-gikai-kaigiroku18-2.pdf",
    );
    expect(meetings[1]!.heldOn).toBe("2025-09-03");
  });

  it("臨時会も正しく抽出する", () => {
    const html = `
      <p><a href="./gonohe-gikai-kaigiroku18-5.pdf">第5回 臨時会　令和7年11月15日<img class="wcv_ww_fileicon" alt="PDFファイル"><span class="wcv_ww_filesize">(200KB)</span></a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("臨時会");
    expect(meetings[0]!.title).toBe("臨時会 第5回");
  });

  it("アンダースコア区切りの PDF ファイル名にも対応する", () => {
    const html = `
      <p><a href="./gonohe-gikai-kaigiroku_16-9.pdf">第9回 定例会　平成28年12月8日<img class="wcv_ww_fileicon" alt="PDFファイル"><span class="wcv_ww_filesize">(500KB)</span></a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.gonohe.aomori.jp/chosei/gikai/gonohe-gikai-kaigiroku_16-9.pdf",
    );
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <p><a href="./gonohe-gikai-kaigiroku18-1.pdf">第1回 定例会　令和7年8月28日<img class="wcv_ww_fileicon" alt="PDFファイル"></a></p>
      <p><a href="./some-document.pdf">議事日程</a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
  });
});
