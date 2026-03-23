import { describe, expect, it } from "vitest";
import {
  convertHeadingToWesternYear,
  detectMeetingType,
  toHalfWidth,
} from "./shared";
import { parseDateFromLinkText, parseIndexPage, parseYearPage } from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年")).toBe("令和6年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertHeadingToWesternYear", () => {
  it("令和の年を変換する", () => {
    expect(convertHeadingToWesternYear("令和6年本会議 会議録（PDFファイル）")).toBe(2024);
  });

  it("令和の全角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和６年本会議 会議録（PDFファイル）")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(convertHeadingToWesternYear("令和元年本会議 会議録（PDFファイル）")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertHeadingToWesternYear("平成30年本会議 会議録（PDFファイル）")).toBe(2018);
    expect(convertHeadingToWesternYear("平成16年本会議 会議録（PDFファイル）")).toBe(2004);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertHeadingToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("定例会1月会議")).toBe("plenary");
    expect(detectMeetingType("定例会12月会議")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("臨時会5月会議")).toBe("extraordinary");
  });
});

describe("parseDateFromLinkText", () => {
  it("半角括弧の日付をパースする", () => {
    expect(parseDateFromLinkText("第1号(1月16日) (PDFファイル: 509.9KB)", 2024)).toBe("2024-01-16");
  });

  it("全角括弧の日付をパースする", () => {
    expect(parseDateFromLinkText("第1号（12月6日） (PDFファイル: 395.9KB)", 2024)).toBe("2024-12-06");
  });

  it("全角数字の日付をパースする", () => {
    expect(parseDateFromLinkText("第１号（１２月６日）", 2024)).toBe("2024-12-06");
  });

  it("月日が1桁でも2桁にゼロパディングする", () => {
    expect(parseDateFromLinkText("第1号(5月2日)", 2024)).toBe("2024-05-02");
  });

  it("日付パターンがない場合はnullを返す", () => {
    expect(parseDateFromLinkText("目次 (PDFファイル: 58.7KB)", 2024)).toBeNull();
  });
});

describe("parseIndexPage", () => {
  it("年度別ページへのリンクを抽出する（絶対URL）", () => {
    const html = `
      <ul>
        <li><a href="https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/12733.html">令和6年本会議 会議録（PDFファイル）</a></li>
        <li><a href="https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/11490.html">令和5年本会議 会議録（PDFファイル）</a></li>
        <li><a href="https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/655.html">平成16年本会議 会議録（PDFファイル）</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.pageUrl).toBe(
      "https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/12733.html",
    );
    expect(result[0]!.linkText).toBe("令和6年本会議 会議録（PDFファイル）");
    expect(result[1]!.pageUrl).toBe(
      "https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/11490.html",
    );
    expect(result[2]!.pageUrl).toBe(
      "https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/655.html",
    );
  });

  it("年度別ページへのリンクを抽出する（相対URL）", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/gikai_jimukyoku/shigikai/kaigiroku/12733.html">令和6年本会議 会議録（PDFファイル）</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pageUrl).toBe(
      "https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/12733.html",
    );
  });

  it("同じURLの重複を除外する", () => {
    const html = `
      <a href="https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/12733.html">令和6年本会議 会議録（PDFファイル）</a>
      <a href="https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/12733.html">令和6年本会議 会議録（PDFファイル）</a>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
  });

  it("kaigiroku 以外のリンクを含まない", () => {
    const html = `
      <a href="/soshiki/other/page.html">他のページ</a>
      <a href="https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/12733.html">令和6年本会議 会議録（PDFファイル）</a>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.linkText).toBe("令和6年本会議 会議録（PDFファイル）");
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseIndexPage("<p>会議録はありません</p>")).toEqual([]);
  });
});

describe("parseYearPage", () => {
  it("h3見出しと第N号PDFリンクを抽出する", () => {
    const html = `
      <h2><strong>令和6年本会議　壱岐市議会本会議</strong></h2>
      <h3><span class="bg"><span class="bg2"><span class="bg3">定例会1月会議</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.city.iki.nagasaki.jp/material/files/group/23/0601gmokuji.pdf">目次 (PDFファイル: 58.7KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.city.iki.nagasaki.jp/material/files/group/23/0601gsingi.pdf">審議期間日程、上程案件及び結果 (PDFファイル: 66.0KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.city.iki.nagasaki.jp/material/files/group/23/0601g1gou.pdf">第1号(1月16日) (PDFファイル: 509.9KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.city.iki.nagasaki.jp/material/files/group/23/0601gikkatu.pdf">一括ダウンロード (PDFファイル: 599.8KB)</a></p>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("定例会1月会議 第1号(1月16日)");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.iki.nagasaki.jp/material/files/group/23/0601g1gou.pdf",
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.headingYear).toBe(2024);
    expect(result[0]!.heldOn).toBe("2024-01-16");
  });

  it("複数の会議セクションを正しく処理する", () => {
    const html = `
      <h2><strong>令和6年本会議　壱岐市議会本会議</strong></h2>
      <h3><span class="bg"><span class="bg2"><span class="bg3">定例会1月会議</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.city.iki.nagasaki.jp/material/files/group/23/0601g1gou.pdf">第1号(1月16日) (PDFファイル: 509.9KB)</a></p>
      <h3><span class="bg"><span class="bg2"><span class="bg3">定例会2月第2回会議</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.city.iki.nagasaki.jp/material/files/group/23/0602-2g1gou.pdf">第1号(2月28日) (PDFファイル: 771.5KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.city.iki.nagasaki.jp/material/files/group/23/0602-2g2gou.pdf">第2号(3月5日) (PDFファイル: 383.5KB)</a></p>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("定例会1月会議 第1号(1月16日)");
    expect(result[0]!.heldOn).toBe("2024-01-16");
    expect(result[1]!.title).toBe("定例会2月第2回会議 第1号(2月28日)");
    expect(result[1]!.heldOn).toBe("2024-02-28");
    expect(result[2]!.title).toBe("定例会2月第2回会議 第2号(3月5日)");
    expect(result[2]!.heldOn).toBe("2024-03-05");
  });

  it("臨時会をextraordinaryと判定する", () => {
    const html = `
      <h3><span class="bg"><span class="bg2"><span class="bg3">臨時会5月会議</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//example.com/rinji.pdf">第1号(5月10日) (PDFファイル: 100KB)</a></p>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("目次・審議期間日程・一括ダウンロードは除外する", () => {
    const html = `
      <h3><span class="bg"><span class="bg2"><span class="bg3">定例会12月会議</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//example.com/mokuji.pdf">目次 (PDFファイル: 58.7KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//example.com/singi.pdf">審議期間日程、上程案件及び結果 (PDFファイル: 66.0KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//example.com/1gou.pdf">第1号（12月6日） (PDFファイル: 395.9KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//example.com/ikkatu.pdf">一括ダウンロード (PDFファイル: 599.8KB)</a></p>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe("https://example.com/1gou.pdf");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    expect(parseYearPage("<p>会議録はありません</p>", 2024)).toEqual([]);
  });

  it("全角括弧の日付も正しく解析する", () => {
    const html = `
      <h3><span class="bg"><span class="bg2"><span class="bg3">定例会12月会議</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.city.iki.nagasaki.jp/material/files/group/23/3dai1gou202412.pdf">第1号（12月6日） (PDFファイル: 395.9KB)</a></p>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-12-06");
    expect(result[0]!.title).toBe("定例会12月会議 第1号（12月6日）");
  });
});
