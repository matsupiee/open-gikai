import { describe, expect, it } from "vitest";
import { cleanLinkText, parseHeldOn, parseListPage } from "./list";

describe("cleanLinkText", () => {
  it("PDF サイズ表記を除去する", () => {
    expect(
      cleanLinkText("令和7年第1回桂川町議会定例会（3月5日）（PDFファイル：2,001KB）"),
    ).toBe("令和7年第1回桂川町議会定例会（3月5日）");
  });
});

describe("parseHeldOn", () => {
  it("月日と年度見出しから開催日を組み立てる", () => {
    expect(
      parseHeldOn("令和7年第1回桂川町議会定例会（3月5日）", 2025),
    ).toBe("2025-03-05");
  });

  it("全角数字にも対応する", () => {
    expect(
      parseHeldOn("令和７年第１回桂川町議会定例会（１２月１２日）", 2025),
    ).toBe("2025-12-12");
  });
});

describe("parseListPage", () => {
  it("h2 見出し配下の PDF リンクを抽出する", () => {
    const html = `
      <h2><img src="../images/icon/midashi01.gif" alt="">令和7年</h2>
      <ul class="pdf">
        <li><a href="../pdf/gikai/kaigiroku_250305.pdf">令和7年第1回桂川町議会定例会（3月5日）（PDFファイル：2,001KB）</a></li>
        <li><a href="../pdf/gikai/kaigiroku_251029.pdf">令和7年第4回桂川町議会臨時会（10月29日）（PDFファイル：352KB）</a></li>
      </ul>
      <h2>令和6年</h2>
      <ul class="pdf">
        <li><a href="../pdf/gikai/kaigiroku_241213.pdf">令和6年第4回桂川町議会定例会（12月13日）（PDFファイル：882KB）</a></li>
      </ul>
    `;

    const results = parseListPage(html, 2025);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: "令和7年第1回桂川町議会定例会（3月5日）",
      pdfUrl:
        "https://www.town.keisen.fukuoka.jp/pdf/gikai/kaigiroku_250305.pdf",
      heldOn: "2025-03-05",
      meetingType: "plenary",
      headingYear: 2025,
    });
    expect(results[1]!.meetingType).toBe("extraordinary");
    expect(results[1]!.heldOn).toBe("2025-10-29");
  });

  it("年度フィルタなしなら複数年度を返す", () => {
    const html = `
      <h2>令和7年</h2>
      <a href="../pdf/gikai/kaigiroku_250305.pdf">令和7年第1回桂川町議会定例会（3月5日）（PDFファイル：2,001KB）</a>
      <h2>平成31年</h2>
      <a href="../pdf/gikai/kaigiroku_190301.pdf">平成31年第1回桂川町議会定例会（3月1日）（PDFファイル：500KB）</a>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(2);
    expect(results[0]!.headingYear).toBe(2025);
    expect(results[1]!.headingYear).toBe(2019);
    expect(results[1]!.heldOn).toBe("2019-03-01");
  });

  it("PDF 以外や日付なしリンクを無視する", () => {
    const html = `
      <h2>令和7年</h2>
      <a href="../pdf/gikai/kaigiroku_250305.pdf">令和7年第1回桂川町議会定例会（3月5日）（PDFファイル：2,001KB）</a>
      <a href="../pdf/gikai/index.html">詳細</a>
      <a href="../pdf/gikai/summary.pdf">議会だより（PDFファイル：120KB）</a>
    `;

    const results = parseListPage(html, 2025);

    expect(results).toHaveLength(1);
    expect(results[0]!.pdfUrl).toContain("kaigiroku_250305.pdf");
  });
});
