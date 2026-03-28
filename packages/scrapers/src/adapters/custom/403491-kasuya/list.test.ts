import { describe, expect, it } from "vitest";
import { extractWesternYear, parseIndexPage, parseYearPage } from "./list";

describe("extractWesternYear", () => {
  it("令和の年度を西暦に変換する", () => {
    expect(extractWesternYear("令和7年 議会会議録")).toBe(2025);
  });

  it("平成の年度を西暦に変換する", () => {
    expect(extractWesternYear("平成23年 議会会議録")).toBe(2011);
  });

  it("平成31年・令和元年を2019として扱う", () => {
    expect(extractWesternYear("平成31年・令和元年 議会会議録")).toBe(2019);
  });

  it("年度がない文字列は null を返す", () => {
    expect(extractWesternYear("議会だより")).toBeNull();
  });
});

describe("parseIndexPage", () => {
  it("年度ページの URL を抽出する", () => {
    const html = `
      <ul class="menu_list">
        <li><a href="../../../s043/010/030/150/20250602111806.html">令和7年 議会会議録</a></li>
        <li><a href="../../../s043/010/030/140/20240524161155.html">令和6年 議会会議録</a></li>
        <li><a href="../../../s043/010/030/010/20200131101855.html">平成31年・令和元年 議会会議録</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      year: 2025,
      yearPageUrl:
        "https://www.town.kasuya.fukuoka.jp/s043/010/030/150/20250602111806.html",
    });
    expect(result[2]).toEqual({
      year: 2019,
      yearPageUrl:
        "https://www.town.kasuya.fukuoka.jp/s043/010/030/010/20200131101855.html",
    });
  });
});

describe("parseYearPage", () => {
  it("PDF リンクと会議種別を抽出する", () => {
    const html = `
      <ul class="file_list">
        <li class="pdf"><a href="./R7-12.pdf" target="_blank">第4回（12月）定例会議録（PDF：1.1MB）</a></li>
        <li class="pdf"><a href="./R7-5rinji-2.pdf" target="_blank">第3回（5月）臨時会議録（PDF：334KB）</a></li>
      </ul>
    `;

    const result = parseYearPage(
      html,
      "https://www.town.kasuya.fukuoka.jp/s043/010/030/150/20250602111806.html",
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      pdfUrl: "https://www.town.kasuya.fukuoka.jp/s043/010/030/150/R7-12.pdf",
      title: "第4回（12月）定例会議録",
      meetingType: "plenary",
    });
    expect(result[1]).toEqual({
      pdfUrl:
        "https://www.town.kasuya.fukuoka.jp/s043/010/030/150/R7-5rinji-2.pdf",
      title: "第3回（5月）臨時会議録",
      meetingType: "extraordinary",
    });
  });
});
