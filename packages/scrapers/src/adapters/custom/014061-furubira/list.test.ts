import { describe, expect, it } from "vitest";
import {
  convertHeadingToWesternYear,
  detectMeetingType,
  toHalfWidth,
} from "./shared";
import { normalizeLinkText, parseListPage, resolveUrl } from "./list";

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
    expect(convertHeadingToWesternYear("令和５年")).toBe(2023);
  });

  it("令和の半角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和7年")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(convertHeadingToWesternYear("令和元年（平成31年）分")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertHeadingToWesternYear("平成30年分")).toBe(2018);
    expect(convertHeadingToWesternYear("平成24年分")).toBe(2012);
  });

  it("平成元年を変換する", () => {
    expect(convertHeadingToWesternYear("平成元年")).toBe(1989);
  });

  it("令和４年分のように「分」が付いても変換できる", () => {
    expect(convertHeadingToWesternYear("令和４年分")).toBe(2022);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertHeadingToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("第1回定例会（第1号）")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });

  it("予算審査特別委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("予算審査特別委員会（第1号）")).toBe("committee");
  });

  it("決算審査特別委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("決算審査特別委員会（第2号）")).toBe("committee");
  });
});

describe("normalizeLinkText", () => {
  it("全角数字を半角に変換する", () => {
    expect(normalizeLinkText("第１回定例会（第１号）")).toBe(
      "第1回定例会（第1号）",
    );
  });

  it("余分な空白を除去する", () => {
    expect(normalizeLinkText("  第１回定例会  ")).toBe("第1回定例会");
  });
});

describe("resolveUrl", () => {
  it("相対パスを絶対URLに変換する", () => {
    expect(
      resolveUrl("../common/img/content/cassette_42_pdf01_20260311_091722.pdf"),
    ).toBe(
      "https://www.town.furubira.lg.jp/common/img/content/cassette_42_pdf01_20260311_091722.pdf",
    );
  });

  it("絶対URLはそのまま返す", () => {
    expect(
      resolveUrl(
        "https://www.town.furubira.lg.jp/common/img/content/test.pdf",
      ),
    ).toBe("https://www.town.furubira.lg.jp/common/img/content/test.pdf");
  });
});

describe("parseListPage", () => {
  it("h2見出しとpdf-listからPDFリンクを抽出する", () => {
    const html = `
      <h2 class="sec-title06"><span>令和８年</span></h2>
      <ul class="pdf-list">
        <li><a href="../common/img/content/cassette_42_pdf01_20260311_091722.pdf" target="_blank">第１回臨時会</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: "第1回臨時会",
      pdfUrl:
        "https://www.town.furubira.lg.jp/common/img/content/cassette_42_pdf01_20260311_091722.pdf",
      meetingType: "extraordinary",
      headingYear: 2026,
    });
  });

  it("複数年度・複数PDFリンクを正しく紐付ける", () => {
    const html = `
      <h2 class="sec-title06"><span>令和７年</span></h2>
      <ul class="pdf-list">
        <li><a href="../common/img/content/cassette_40_pdf01.pdf" target="_blank">第１回臨時会</a></li>
        <li><a href="../common/img/content/cassette_2_pdf02.pdf" target="_blank">第１回定例会（第１号）</a></li>
      </ul>
      <h2 class="sec-title06"><span>令和６年</span></h2>
      <ul class="pdf-list">
        <li><a href="../common/img/content/cassette_37_pdf01.pdf" target="_blank">第１回臨時会</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.headingYear).toBe(2025);
    expect(result[0]!.title).toBe("第1回臨時会");
    expect(result[1]!.headingYear).toBe(2025);
    expect(result[1]!.title).toBe("第1回定例会（第1号）");
    expect(result[2]!.headingYear).toBe(2024);
  });

  it("1つの年度に複数のpdf-listがある場合も正しく紐付ける", () => {
    const html = `
      <h2 class="sec-title06"><span>令和5年</span></h2>
      <ul class="pdf-list">
        <li><a href="../common/img/content/a.pdf" target="_blank">第１回臨時会</a></li>
        <li><a href="../common/img/content/b.pdf" target="_blank">第１回定例会（第１号）</a></li>
      </ul>
      <ul class="pdf-list">
        <li><a href="../common/img/content/c.pdf" target="_blank">第３回定例会（第１号）</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.headingYear).toBe(2023);
    expect(result[1]!.headingYear).toBe(2023);
    expect(result[2]!.headingYear).toBe(2023);
    expect(result[2]!.title).toBe("第3回定例会（第1号）");
  });

  it("docxファイルを除外する", () => {
    const html = `
      <h2 class="sec-title06"><span>平成28年分</span></h2>
      <ul class="pdf-list">
        <li><a href="../common/img/content/test.docx" target="_blank">第4回定例会</a></li>
        <li><a href="../common/img/content/test.pdf" target="_blank">決算審査特別委員会（第1号）</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("決算審査特別委員会（第1号）");
  });

  it("令和元年（平成31年）分の見出しを正しく変換する", () => {
    const html = `
      <h2 class="sec-title06"><span>令和元年（平成31年）分</span></h2>
      <ul class="pdf-list">
        <li><a href="../common/img/content/test.pdf" target="_blank">第１回定例会（第１号）</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.headingYear).toBe(2019);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("予算審査特別委員会をcommitteeとして分類する", () => {
    const html = `
      <h2 class="sec-title06"><span>令和７年</span></h2>
      <ul class="pdf-list">
        <li><a href="../common/img/content/test.pdf" target="_blank">予算審査特別委員会（第１号）</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("committee");
    expect(result[0]!.title).toBe("予算審査特別委員会（第1号）");
  });
});
