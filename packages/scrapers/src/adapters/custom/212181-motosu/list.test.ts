import { describe, expect, it } from "vitest";
import {
  detectMeetingType,
  extractDateFromText,
  toHalfWidth,
} from "./shared";
import {
  isContentPdfLink,
  normalizeLinkText,
  parseCategoryPage,
  parseDetailPage,
  resolveUrl,
} from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年")).toBe("令和6年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("extractDateFromText", () => {
  it("令和の日付を変換する", () => {
    expect(extractDateFromText("令和6年11月25日（月曜日）")).toBe("2024-11-25");
  });

  it("全角数字の令和日付を変換する", () => {
    expect(extractDateFromText("令和７年３月５日")).toBe("2025-03-05");
  });

  it("令和元年に対応する", () => {
    expect(extractDateFromText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(extractDateFromText("平成30年12月10日")).toBe("2018-12-10");
  });

  it("平成元年に対応する", () => {
    expect(extractDateFromText("平成元年3月15日")).toBe("1989-03-15");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractDateFromText("会議録")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("令和6年第4回定例会会議録")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("平成16年第1回臨時会会議録")).toBe("extraordinary");
  });

  it("委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });

  it("審査会をcommitteeと判定する", () => {
    expect(detectMeetingType("連合審査会")).toBe("committee");
  });
});

describe("normalizeLinkText", () => {
  it("全角数字を半角に変換する", () => {
    expect(normalizeLinkText("１１月２５日（月曜日）")).toBe(
      "11月25日（月曜日）",
    );
  });

  it("余分な空白を除去する", () => {
    expect(normalizeLinkText("  11月25日  ")).toBe("11月25日");
  });
});

describe("resolveUrl", () => {
  it("相対パスを絶対URLに変換する（スラッシュあり）", () => {
    expect(resolveUrl("/1234567.html")).toBe(
      "https://www.city.motosu.lg.jp/1234567.html",
    );
  });

  it("./形式の相対パスをベースURLで解決する", () => {
    expect(
      resolveUrl(
        "./cmsfiles/contents/1234/5678901/R6_dai4_1gou.pdf",
        "https://www.city.motosu.lg.jp",
      ),
    ).toBe(
      "https://www.city.motosu.lg.jp/cmsfiles/contents/1234/5678901/R6_dai4_1gou.pdf",
    );
  });

  it("絶対URLはそのまま返す", () => {
    expect(
      resolveUrl(
        "https://www.city.motosu.lg.jp/cmsfiles/contents/1234/5678901/R6_dai4_1gou.pdf",
      ),
    ).toBe(
      "https://www.city.motosu.lg.jp/cmsfiles/contents/1234/5678901/R6_dai4_1gou.pdf",
    );
  });
});

describe("isContentPdfLink", () => {
  it("N月N日（曜日略記）形式のリンクテキストを本文PDFと判定する", () => {
    expect(isContentPdfLink("11月25日（月）")).toBe(true);
    expect(isContentPdfLink("3月5日（水）")).toBe(true);
  });

  it("N月N日（曜日）形式のリンクテキストを本文PDFと判定する", () => {
    expect(isContentPdfLink("11月25日（月曜日）")).toBe(true);
    expect(isContentPdfLink("3月5日（水曜日）")).toBe(true);
  });

  it("全角数字のN月N日（曜日略記）形式を本文PDFと判定する", () => {
    expect(isContentPdfLink("１１月２５日（月）")).toBe(true);
  });

  it("「付された案件」はスキップする", () => {
    expect(isContentPdfLink("第4回定例会に付された案件")).toBe(false);
  });

  it("「議案」はスキップする", () => {
    expect(isContentPdfLink("議案一覧")).toBe(false);
  });

  it("括弧なしはスキップする", () => {
    expect(isContentPdfLink("11月25日")).toBe(false);
  });
});

describe("parseCategoryPage", () => {
  it("定例会リンクを収集する（絶対URL形式）", () => {
    const html = `
      <ul>
        <li><a href="https://www.city.motosu.lg.jp/0000002765.html"><span class="cate_post_title">令和6年第4回定例会会議録</span></a></li>
        <li><a href="https://www.city.motosu.lg.jp/0000002662.html"><span class="cate_post_title">令和6年第3回定例会会議録</span></a></li>
      </ul>
    `;

    const result = parseCategoryPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      url: "https://www.city.motosu.lg.jp/0000002765.html",
      sessionTitle: "令和6年第4回定例会会議録",
      meetingType: "plenary",
    });
    expect(result[1]!.sessionTitle).toBe("令和6年第3回定例会会議録");
  });

  it("定例会リンクを収集する（相対パス形式）", () => {
    const html = `
      <ul>
        <li><a href="/0000002765.html">令和6年第4回本巣市議会定例会会議録</a></li>
        <li><a href="/0000002662.html">令和6年第3回本巣市議会定例会会議録</a></li>
      </ul>
    `;

    const result = parseCategoryPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      url: "https://www.city.motosu.lg.jp/0000002765.html",
      sessionTitle: "令和6年第4回本巣市議会定例会会議録",
      meetingType: "plenary",
    });
    expect(result[1]!.sessionTitle).toBe("令和6年第3回本巣市議会定例会会議録");
  });

  it("臨時会リンクを収集する", () => {
    const html = `
      <ul>
        <li><a href="https://www.city.motosu.lg.jp/0000001234.html"><span class="cate_post_title">平成16年第1回臨時会会議録</span></a></li>
      </ul>
    `;

    const result = parseCategoryPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.sessionTitle).toBe("平成16年第1回臨時会会議録");
  });

  it("定例会・臨時会以外のリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="https://www.city.motosu.lg.jp/0000001000.html">令和6年度会議録一覧</a></li>
        <li><a href="https://www.city.motosu.lg.jp/0000002765.html">令和6年第4回本巣市議会定例会会議録</a></li>
        <li><a href="https://www.city.motosu.lg.jp/0000000001.html">会議録トップ</a></li>
      </ul>
    `;

    const result = parseCategoryPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.sessionTitle).toBe("令和6年第4回本巣市議会定例会会議録");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    const result = parseCategoryPage(html);
    expect(result).toEqual([]);
  });
});

describe("parseDetailPage", () => {
  it("本文PDFリンクを収集する（曜日略記形式）", () => {
    const html = `
      <ul>
        <li><a href="./cmsfiles/contents/0000002/2765/R6_dai4_1gou.pdf"><img src="images/pdf.gif" alt=""> 11月25日（月）(PDF形式、367.63KB)</a></li>
        <li><a href="./cmsfiles/contents/0000002/2765/R6_dai4_2gou.pdf"><img src="images/pdf.gif" alt=""> 12月6日（金）(PDF形式、625.21KB)</a></li>
      </ul>
    `;
    const detailPageUrl = "https://www.city.motosu.lg.jp/0000002765.html";

    const result = parseDetailPage(
      html,
      "令和6年第4回定例会会議録",
      "plenary",
      detailPageUrl,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "11月25日（月）(PDF形式、367.63KB)",
      pdfUrl:
        "https://www.city.motosu.lg.jp/cmsfiles/contents/0000002/2765/R6_dai4_1gou.pdf",
      meetingType: "plenary",
      heldOn: null,
      sessionTitle: "令和6年第4回定例会会議録",
    });
    expect(result[1]!.title).toBe("12月6日（金）(PDF形式、625.21KB)");
  });

  it("「付された案件」PDFをスキップする", () => {
    const html = `
      <ul>
        <li><a href="./cmsfiles/contents/0000002/2765/R6_dai4_anken.pdf"> 第4回定例会に付された案件 (PDF形式)</a></li>
        <li><a href="./cmsfiles/contents/0000002/2765/R6_dai4_1gou.pdf"> 11月25日（月）(PDF形式)</a></li>
      </ul>
    `;
    const detailPageUrl = "https://www.city.motosu.lg.jp/0000002765.html";

    const result = parseDetailPage(
      html,
      "令和6年第4回定例会会議録",
      "plenary",
      detailPageUrl,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("11月25日（月）(PDF形式)");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>準備中</p>";
    const detailPageUrl = "https://www.city.motosu.lg.jp/0000002765.html";
    const result = parseDetailPage(
      html,
      "令和6年第4回定例会会議録",
      "plenary",
      detailPageUrl,
    );
    expect(result).toEqual([]);
  });
});
