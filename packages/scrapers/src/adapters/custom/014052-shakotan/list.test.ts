import { describe, expect, it } from "vitest";
import {
  convertHeadingToWesternYear,
  detectMeetingType,
  toHalfWidth,
} from "./shared";
import { normalizeLinkText, parseTopPage, parseYearPage } from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和８年")).toBe("令和8年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertHeadingToWesternYear", () => {
  it("令和の全角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和８年")).toBe(2026);
    expect(convertHeadingToWesternYear("令和７年")).toBe(2025);
  });

  it("令和の半角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和6年")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(convertHeadingToWesternYear("令和元年（平成31年）")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertHeadingToWesternYear("平成30年")).toBe(2018);
    expect(convertHeadingToWesternYear("平成20年")).toBe(2008);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertHeadingToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("令和7年第4回積丹町議会定例会の結果")).toBe(
      "plenary",
    );
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("令和7年第1回積丹町議会臨時会の結果")).toBe(
      "extraordinary",
    );
  });
});

describe("normalizeLinkText", () => {
  it("全角数字を半角に変換する", () => {
    expect(
      normalizeLinkText("令和７年第４回積丹町議会定例会の結果"),
    ).toBe("令和7年第4回積丹町議会定例会の結果");
  });

  it("余分な空白を除去する", () => {
    expect(normalizeLinkText("  令和７年第１回  ")).toBe("令和7年第1回");
  });
});

describe("parseTopPage", () => {
  it("richtext div 内の年度リンクを抽出する", () => {
    const html = `
      <div class="richtext">
        <ul>
          <li><a href="/contents/post-212.html">令和8年</a></li>
          <li><a href="/contents/post-179.html">令和7年</a></li>
          <li><a href="/contents/6.html">令和6年</a></li>
        </ul>
      </div>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      year: 2026,
      pageUrl: "https://www.town.shakotan.lg.jp/contents/post-212.html",
    });
    expect(result[1]).toEqual({
      year: 2025,
      pageUrl: "https://www.town.shakotan.lg.jp/contents/post-179.html",
    });
    expect(result[2]).toEqual({
      year: 2024,
      pageUrl: "https://www.town.shakotan.lg.jp/contents/6.html",
    });
  });

  it("平成の年度リンクも抽出する", () => {
    const html = `
      <div class="richtext">
        <ul>
          <li><a href="/contents/content0738.html">平成31年（令和元年）</a></li>
          <li><a href="/contents/content0726.html">平成30年</a></li>
        </ul>
      </div>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2019);
    expect(result[1]!.year).toBe(2018);
  });

  it("richtext div がない場合は空配列を返す", () => {
    const html = "<p>コンテンツなし</p>";
    expect(parseTopPage(html)).toEqual([]);
  });

  it("年度を含まないリンクは無視する", () => {
    const html = `
      <div class="richtext">
        <ul>
          <li><a href="/contents/top.html">議会トップ</a></li>
          <li><a href="/contents/post-179.html">令和7年</a></li>
        </ul>
      </div>
    `;

    const result = parseTopPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
  });
});

describe("parseYearPage", () => {
  it("richtext div 内の PDF リンクを抽出する", () => {
    const html = `
      <div class="richtext">
        <ul>
          <li><a href="/contents/e4a8a0f8d7aa31391bad3fd9e0905e90a5357571.pdf">令和7年第4回積丹町議会定例会の結果</a></li>
          <li><a href="/contents/abc123.pdf">令和7年第3回積丹町議会定例会の結果</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和7年第4回積丹町議会定例会の結果",
      pdfUrl:
        "https://www.town.shakotan.lg.jp/contents/e4a8a0f8d7aa31391bad3fd9e0905e90a5357571.pdf",
      meetingType: "plenary",
      headingYear: 2025,
    });
  });

  it("臨時会リンクを正しく分類する", () => {
    const html = `
      <div class="richtext">
        <ul>
          <li><a href="/contents/temp.pdf">令和7年第1回積丹町議会臨時会の結果</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("相対パスの PDF リンクを絶対 URL に変換する", () => {
    const html = `
      <div class="richtext">
        <ul>
          <li><a href="f674f1c325b9b945fa6853a707a4423a727b27ca.pdf">令和7年第2回積丹町議会定例会の結果</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.shakotan.lg.jp/contents/f674f1c325b9b945fa6853a707a4423a727b27ca.pdf",
    );
  });

  it("PDF でないリンクを除外する", () => {
    const html = `
      <div class="richtext">
        <ul>
          <li><a href="/contents/page.html">年度別ページ</a></li>
          <li><a href="/contents/abc.pdf">令和7年第1回積丹町議会定例会の結果</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, 2025);
    expect(result).toHaveLength(1);
  });

  it("richtext div がない場合は空配列を返す", () => {
    const html = "<p>コンテンツなし</p>";
    expect(parseYearPage(html, 2025)).toEqual([]);
  });
});
