import { describe, it, expect } from "vitest";
import { parseListPage, toHeldOn } from "./list";

describe("toHeldOn", () => {
  it("令和の和暦年と月から西暦日付を生成する", () => {
    expect(toHeldOn("R", 6, 4)).toBe("2024-04-01");
  });

  it("令和の1月を正しく変換する", () => {
    expect(toHeldOn("R", 7, 1)).toBe("2025-01-01");
  });

  it("平成の和暦年と月から西暦日付を生成する", () => {
    expect(toHeldOn("H", 30, 6)).toBe("2018-06-01");
  });

  it("月が1桁の場合ゼロパディングする", () => {
    expect(toHeldOn("R", 6, 5)).toBe("2024-05-01");
  });

  it("月が2桁の場合そのまま", () => {
    expect(toHeldOn("R", 6, 12)).toBe("2024-12-01");
  });
});

const LIST_HTML = `
<h2>令和6年度定例会会議録</h2>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_4.pdf">令和6年4月定例会 (PDFファイル: 258.1KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_5.pdf">令和6年5月定例会 (PDFファイル: 242.1KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_6.pdf">令和6年6月定例会 (PDFファイル: 249.2KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_7shusei.pdf">令和6年7月定例会 (PDFファイル: 191.8KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_8shusei.pdf">令和6年8月定例会 (PDFファイル: 299.7KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_9.pdf">令和6年9月定例会 (PDFファイル: 313.5KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_10.pdf">令和6年10月定例会 (PDFファイル: 168.4KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_11.pdf">令和6年11月定例会 (PDFファイル: 250.4KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_12.pdf">令和6年12月定例会 (PDFファイル: 233.6KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R7_1.pdf">令和7年1月定例会 (PDFファイル: 268.5KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R7_2.pdf">令和7年2月定例会 (PDFファイル: 235.3KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R7_3rinji.pdf">令和7年3月臨時会 (PDFファイル: 121.1KB)</a></p>
<p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R7_3.pdf">令和7年3月定例会 (PDFファイル: 180.1KB)</a></p>
`;

describe("parseListPage", () => {
  it("R6 プレフィックスの PDF を抽出する", () => {
    const meetings = parseListPage(LIST_HTML, "R6");

    // R6_4, R6_5, R6_6, R6_7shusei, R6_8shusei, R6_9, R6_10, R6_11, R6_12
    expect(meetings.length).toBe(9);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.asahi.yamagata.jp/material/files/group/11/R6_4.pdf"
    );
    expect(meetings[0]!.title).toBe("令和6年4月定例会");
    expect(meetings[0]!.heldOn).toBe("2024-04-01");
    expect(meetings[0]!.sessionName).toBe("定例会");
  });

  it("修正版がある月は通常版をスキップする", () => {
    const meetings = parseListPage(LIST_HTML, "R6");

    // 7月: R6_7shusei.pdf のみ（R6_7.pdf はリストに存在しないが修正版ルールを確認）
    const july = meetings.filter((m) => m.heldOn === "2024-07-01");
    expect(july.length).toBe(1);
    expect(july[0]!.pdfUrl).toContain("R6_7shusei.pdf");
  });

  it("R7 プレフィックスの PDF を抽出する", () => {
    const meetings = parseListPage(LIST_HTML, "R7");

    // R7_1, R7_2, R7_3rinji, R7_3
    expect(meetings.length).toBe(4);

    expect(meetings[0]!.pdfUrl).toContain("R7_1.pdf");
    expect(meetings[0]!.heldOn).toBe("2025-01-01");
  });

  it("臨時会を正しく識別する", () => {
    const meetings = parseListPage(LIST_HTML, "R7");

    const rinji = meetings.find((m) => m.pdfUrl.includes("rinji"));
    expect(rinji).toBeDefined();
    expect(rinji!.sessionName).toBe("臨時会");
    expect(rinji!.title).toBe("令和7年3月臨時会");
  });

  it("存在しないプレフィックスは空配列を返す", () => {
    const meetings = parseListPage(LIST_HTML, "R99");
    expect(meetings.length).toBe(0);
  });

  it("material/files/group/11/ 以外の PDF はスキップする", () => {
    const html = `
      <p><a href="//www.town.asahi.yamagata.jp/material/files/group/99/R6_4.pdf">別グループ</a></p>
    `;
    const meetings = parseListPage(html, "R6");
    expect(meetings.length).toBe(0);
  });

  it("修正版がある月で通常版と修正版の両方がある場合、修正版のみ残す", () => {
    const html = `
      <p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_7.pdf">令和6年7月定例会 (PDFファイル: 200KB)</a></p>
      <p><a href="//www.town.asahi.yamagata.jp/material/files/group/11/R6_7shusei.pdf">令和6年7月定例会 (PDFファイル: 191.8KB)</a></p>
    `;
    const meetings = parseListPage(html, "R6");
    expect(meetings.length).toBe(1);
    expect(meetings[0]!.pdfUrl).toContain("R6_7shusei.pdf");
  });
});
