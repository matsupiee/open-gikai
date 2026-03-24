import { describe, expect, it } from "vitest";
import {
  detectMeetingType,
  extractDateFromText,
  toHalfWidth,
} from "./shared";
import {
  extractSessionTitle,
  normalizeLinkText,
  parseSessionPage,
  parseYearPage,
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
    expect(extractDateFromText("初日（令和6年11月28日）")).toBe("2024-11-28");
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
    expect(detectMeetingType("第4回定例会（11月28日〜12月20日）")).toBe(
      "plenary",
    );
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("第1回臨時会（2月2日）")).toBe("extraordinary");
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
    expect(normalizeLinkText("第１回定例会")).toBe("第1回定例会");
  });

  it("余分な空白を除去する", () => {
    expect(normalizeLinkText("  初日  ")).toBe("初日");
  });
});

describe("resolveUrl", () => {
  it("相対パスを絶対URLに変換する", () => {
    expect(resolveUrl("/secure/1234/R6.4T.11.28.pdf")).toBe(
      "https://www.city.mizuho.lg.jp/secure/1234/R6.4T.11.28.pdf",
    );
  });

  it("絶対URLはそのまま返す", () => {
    expect(
      resolveUrl(
        "https://www.city.mizuho.lg.jp/secure/1234/R6.4T.11.28.pdf",
      ),
    ).toBe("https://www.city.mizuho.lg.jp/secure/1234/R6.4T.11.28.pdf");
  });
});

describe("extractSessionTitle", () => {
  it("定例会の見出しからセッションタイトルを抽出する", () => {
    expect(
      extractSessionTitle("第4回定例会（11月28日〜12月20日）"),
    ).toBe("第4回定例会");
  });

  it("臨時会の見出しからセッションタイトルを抽出する", () => {
    expect(extractSessionTitle("第1回臨時会（2月2日）")).toBe("第1回臨時会");
  });

  it("全角数字を半角に変換する", () => {
    expect(extractSessionTitle("第４回定例会（１１月）")).toBe("第4回定例会");
  });

  it("括弧のないタイトルはそのまま返す", () => {
    expect(extractSessionTitle("第2回定例会")).toBe("第2回定例会");
  });
});

describe("parseYearPage", () => {
  it("定例会リンクを収集する", () => {
    const html = `
      <ul>
        <li><a href="/13611.htm">第４回定例会（11月28日〜12月20日）</a></li>
        <li><a href="/13520.htm">第3回定例会（9月2日〜27日）</a></li>
      </ul>
    `;

    const result = parseYearPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      url: "https://www.city.mizuho.lg.jp/13611.htm",
      sessionTitle: "第4回定例会",
      meetingType: "plenary",
    });
    expect(result[1]!.sessionTitle).toBe("第3回定例会");
  });

  it("臨時会リンクを収集する", () => {
    const html = `
      <ul>
        <li><a href="/13414.htm">第2回臨時会（5月10日）</a></li>
      </ul>
    `;

    const result = parseYearPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.sessionTitle).toBe("第2回臨時会");
  });

  it("定例会・臨時会以外のリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/13295.htm">令和6年度</a></li>
        <li><a href="/13611.htm">第4回定例会（11月28日〜12月20日）</a></li>
        <li><a href="/3412.htm">会議録トップ</a></li>
      </ul>
    `;

    const result = parseYearPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.sessionTitle).toBe("第4回定例会");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    const result = parseYearPage(html);
    expect(result).toEqual([]);
  });
});

describe("parseSessionPage", () => {
  it("PDF リンクを収集する", () => {
    const html = `
      <ul>
        <li><a href="/secure/5678/R6.4T.11.28.pdf">初日（11月28日）</a>　284KB</li>
        <li><a href="/secure/5678/R6.4T.12.6.pdf">総括質疑（12月6日）</a>　355KB</li>
      </ul>
    `;

    const result = parseSessionPage(html, "第4回定例会", "plenary");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "初日（11月28日）",
      pdfUrl:
        "https://www.city.mizuho.lg.jp/secure/5678/R6.4T.11.28.pdf",
      meetingType: "plenary",
      heldOn: null,
      sessionTitle: "第4回定例会",
    });
    expect(result[1]!.title).toBe("総括質疑（12月6日）");
  });

  it("目次PDFをスキップする", () => {
    const html = `
      <ul>
        <li><a href="/secure/5678/R6.4Tmokuji.pdf">目次</a>　53KB</li>
        <li><a href="/secure/5678/R6.4T.11.28.pdf">初日（11月28日）</a>　284KB</li>
      </ul>
    `;

    const result = parseSessionPage(html, "第4回定例会", "plenary");

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("初日（11月28日）");
  });

  it("日付を含むリンクテキストからheldOnを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/secure/5678/R6.1T.2.22.pdf">初日（令和6年2月22日）</a>　200KB</li>
      </ul>
    `;

    const result = parseSessionPage(html, "第1回定例会", "plenary");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-02-22");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>準備中</p>";
    const result = parseSessionPage(html, "第1回定例会", "plenary");
    expect(result).toEqual([]);
  });
});
