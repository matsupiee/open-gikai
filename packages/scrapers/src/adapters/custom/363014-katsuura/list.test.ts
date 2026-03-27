import { describe, expect, it } from "vitest";
import {
  cleanLinkText,
  parseFiscalYearPage,
  parseIndexPage,
  parseMeetingMonth,
} from "./list";

describe("parseIndexPage", () => {
  it("年度ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gikai/kaigiroku/index.html">令和7年度</a></li>
        <li><a href="/gikai/kaigiroku/r6/">令和6年度</a></li>
        <li><a href="/gikai/kaigiroku/h31/">平成31年度/令和元年度</a></li>
      </ul>
    `;

    expect(parseIndexPage(html)).toEqual([
      {
        fiscalYear: 2025,
        url: "https://www.town.katsuura.lg.jp/gikai/kaigiroku/index.html",
        label: "令和7年度",
      },
      {
        fiscalYear: 2024,
        url: "https://www.town.katsuura.lg.jp/gikai/kaigiroku/r6/",
        label: "令和6年度",
      },
      {
        fiscalYear: 2019,
        url: "https://www.town.katsuura.lg.jp/gikai/kaigiroku/h31/",
        label: "平成31年度/令和元年度",
      },
    ]);
  });
});

describe("cleanLinkText", () => {
  it("PDF サイズ表記を除去する", () => {
    expect(cleanLinkText("3月（ひな会議）6[PDF：980KB]")).toBe("3月（ひな会議）6");
  });
});

describe("parseMeetingMonth", () => {
  it("会議タイトルから月を抽出する", () => {
    expect(parseMeetingMonth("3月（ひな会議）6")).toBe(3);
    expect(parseMeetingMonth("12月会議")).toBe(12);
  });
});

describe("parseFiscalYearPage", () => {
  it("前年度ページから対象年の1月〜3月会議を抽出する", () => {
    const html = `
      <div class="body">
        <p><a href="/_files/r6_12.pdf" class="iconFile iconPdf">12月会議[PDF：506KB]</a></p>
        <p><a href="/_files/r7_1.pdf" class="iconFile iconPdf">1月会議[PDF：281KB]</a></p>
        <p><a href="/_files/r7_2.pdf" class="iconFile iconPdf">2月会議[PDF：428KB]</a></p>
      </div>
    `;

    expect(
      parseFiscalYearPage(
        html,
        2024,
        2025,
        "https://www.town.katsuura.lg.jp/gikai/kaigiroku/r6/",
      ),
    ).toEqual([
      {
        pdfUrl: "https://www.town.katsuura.lg.jp/_files/r7_1.pdf",
        title: "1月会議",
        pageUrl: "https://www.town.katsuura.lg.jp/gikai/kaigiroku/r6/",
        fiscalYear: 2024,
        month: 1,
        meetingType: "plenary",
      },
      {
        pdfUrl: "https://www.town.katsuura.lg.jp/_files/r7_2.pdf",
        title: "2月会議",
        pageUrl: "https://www.town.katsuura.lg.jp/gikai/kaigiroku/r6/",
        fiscalYear: 2024,
        month: 2,
        meetingType: "plenary",
      },
    ]);
  });

  it("当年度ページから対象年の4月〜12月会議だけを返す", () => {
    const html = `
      <div class="body">
        <p><a href="/_files/r7_5.pdf" class="iconFile iconPdf">5月会議[PDF：330KB]</a></p>
        <p><a href="/_files/r8_1.pdf" class="iconFile iconPdf">1月会議[PDF：281KB]</a></p>
      </div>
    `;

    expect(
      parseFiscalYearPage(
        html,
        2025,
        2025,
        "https://www.town.katsuura.lg.jp/gikai/kaigiroku/index.html",
      ),
    ).toEqual([
      {
        pdfUrl: "https://www.town.katsuura.lg.jp/_files/r7_5.pdf",
        title: "5月会議",
        pageUrl: "https://www.town.katsuura.lg.jp/gikai/kaigiroku/index.html",
        fiscalYear: 2025,
        month: 5,
        meetingType: "plenary",
      },
    ]);
  });
});
