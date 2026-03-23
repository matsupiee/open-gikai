import { describe, expect, it } from "vitest";
import { parseYearPageLinks, parsePdfLinks } from "./list";
import { parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年第1回")).toBe(2025);
    expect(parseWarekiYear("令和2年第3回")).toBe(2020);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第2回")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("parseYearPageLinks", () => {
  it("年度ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li>
          <span class="article_date">2025年06月20日</span>
          <span class="article_title"><a href="/site/gikai/14987.html">令和7年　定例会・臨時会の会議録</a></span>
        </li>
        <li>
          <span class="article_date">2024年12月25日</span>
          <span class="article_title"><a href="/site/gikai/12064.html">令和6年　定例会・臨時会の会議録</a></span>
        </li>
        <li>
          <span class="article_date">2023年12月20日</span>
          <span class="article_title"><a href="/site/gikai/8069.html">令和5年　定例会・臨時会の会議録</a></span>
        </li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      year: 2025,
      url: "https://www.akiota.jp/site/gikai/14987.html",
      pageId: "14987",
    });
    expect(result[1]).toEqual({
      year: 2024,
      url: "https://www.akiota.jp/site/gikai/12064.html",
      pageId: "12064",
    });
    expect(result[2]).toEqual({
      year: 2023,
      url: "https://www.akiota.jp/site/gikai/8069.html",
      pageId: "8069",
    });
  });

  it("年度リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseYearPageLinks(html)).toEqual([]);
  });

  it("重複するページIDを除外する", () => {
    const html = `
      <a href="/site/gikai/14987.html">令和7年　定例会・臨時会の会議録</a>
      <a href="/site/gikai/14987.html">令和7年　定例会・臨時会の会議録</a>
    `;

    const result = parseYearPageLinks(html);
    expect(result).toHaveLength(1);
  });
});

describe("parsePdfLinks", () => {
  it("PDF リンクを抽出しメタ情報をパースする", () => {
    const html = `
      <h2>第1回定例会</h2>
      <div class="file_pdf">
        <a href="/uploaded/life/17650_39314_misc.pdf">令和7年第1回安芸太田町議会定例会会議録（2月21日）  [PDFファイル／401KB]</a>
        <a href="/uploaded/life/17650_39315_misc.pdf">令和7年第1回安芸太田町議会定例会会議録（2月25日）  [PDFファイル／599KB]</a>
      </div>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和7年第1回安芸太田町議会定例会会議録（2月21日）",
      heldOn: "2025-02-21",
      pdfUrl: "https://www.akiota.jp/uploaded/life/17650_39314_misc.pdf",
      meetingType: "plenary",
    });
    expect(result[1]).toEqual({
      title: "令和7年第1回安芸太田町議会定例会会議録（2月25日）",
      heldOn: "2025-02-25",
      pdfUrl: "https://www.akiota.jp/uploaded/life/17650_39315_misc.pdf",
      meetingType: "plenary",
    });
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <h2>第2回臨時会</h2>
      <div class="file_pdf">
        <a href="/uploaded/life/17650_39320_misc.pdf">令和7年第2回安芸太田町議会臨時会会議録（4月14日）  [PDFファイル／371KB]</a>
      </div>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2025-04-14");
  });

  it("複数セクション（定例会+臨時会）を正しく処理する", () => {
    const html = `
      <h2>第1回定例会</h2>
      <div class="file_pdf">
        <a href="/uploaded/life/1_1_misc.pdf">令和6年第1回安芸太田町議会定例会会議録（3月5日）  [PDFファイル／300KB]</a>
      </div>
      <h2>第1回臨時会</h2>
      <div class="file_pdf">
        <a href="/uploaded/life/2_2_misc.pdf">令和6年第1回安芸太田町議会臨時会会議録（5月10日）  [PDFファイル／200KB]</a>
      </div>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.heldOn).toBe("2024-03-05");
    expect(result[1]!.meetingType).toBe("extraordinary");
    expect(result[1]!.heldOn).toBe("2024-05-10");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<h2>第1回定例会</h2><p>現在準備中です</p>";
    expect(parsePdfLinks(html)).toEqual([]);
  });

  it("メタ情報が抽出できないリンクはスキップする", () => {
    const html = `
      <div class="file_pdf">
        <a href="/uploaded/life/1_1_misc.pdf">不明なタイトル  [PDFファイル／100KB]</a>
        <a href="/uploaded/life/2_2_misc.pdf">令和7年第1回安芸太田町議会定例会会議録（3月5日）  [PDFファイル／300KB]</a>
      </div>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2025-03-05");
  });
});
