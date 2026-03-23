import { describe, expect, it } from "vitest";
import { parseListPage, parseDetailPage } from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第5回氷川町議会定例会会議録")).toBe(2024);
    expect(parseWarekiYear("令和元年第1回氷川町議会定例会会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成24年第1回氷川町議会定例会会議録")).toBe(2012);
    expect(parseWarekiYear("平成30年第4回氷川町議会定例会会議録")).toBe(2018);
    expect(parseWarekiYear("平成元年第1回定例会会議録")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和6年第5回氷川町議会定例会会議録")).toBe(
      "plenary",
    );
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和7年第8回氷川町議会臨時会会議録")).toBe(
      "extraordinary",
    );
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("令和6年総務委員会会議録")).toBe("committee");
  });
});

describe("parseListPage", () => {
  it("年度別一覧ページから会議録詳細リンクを抽出する", () => {
    const html = `
      <ul>
        <li>
          2025年1月10日更新
          <a href="https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/index.html">
            令和6年第5回氷川町議会定例会会議録
          </a>
        </li>
        <li>
          2024年11月15日更新
          <a href="https://www.town.hikawa.kumamoto.jp/gikai/kiji0036145/index.html">
            令和6年第4回氷川町議会定例会会議録
          </a>
        </li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和6年第5回氷川町議会定例会会議録",
      url: "https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/index.html",
    });
    expect(result[1]).toEqual({
      title: "令和6年第4回氷川町議会定例会会議録",
      url: "https://www.town.hikawa.kumamoto.jp/gikai/kiji0036145/index.html",
    });
  });

  it("相対パスを絶対URLに変換する", () => {
    const html = `
      <a href="/gikai/kiji0036193/index.html">令和6年第5回氷川町議会定例会会議録</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(
      "https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/index.html",
    );
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/gikai/kiji0036193/index.html">令和6年第5回</a>
      <a href="/gikai/kiji0036193/index.html">令和6年第5回（重複）</a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseListPage(html)).toEqual([]);
  });
});

describe("parseDetailPage", () => {
  it("詳細ページからPDFリンクを抽出する", () => {
    const html = `
      <a href="https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/3_6193_5726_up_ubwtka57.pdf">
        令和6年第5回氷川町議会定例会会議録(第1号)（PDF：554.2キロバイト）
      </a>
      <a href="https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/3_6193_5784_up_uc7bwu84.pdf">
        令和6年第5回氷川町議会定例会会議録（第2号）（PDF：778.1キロバイト）
      </a>
    `;

    const result = parseDetailPage(
      html,
      "令和6年第5回氷川町議会定例会会議録",
      "https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/index.html",
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和6年第5回氷川町議会定例会会議録",
      pdfUrl:
        "https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/3_6193_5726_up_ubwtka57.pdf",
      pdfLabel: "令和6年第5回氷川町議会定例会会議録(第1号)",
      meetingType: "plenary",
      detailPageUrl:
        "https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/index.html",
    });
    expect(result[1]!.pdfLabel).toBe(
      "令和6年第5回氷川町議会定例会会議録（第2号）",
    );
  });

  it("相対パスのPDFリンクを絶対URLに変換する", () => {
    const html = `
      <a href="/gikai/kiji0036193/3_6193_5726_up_ubwtka57.pdf">
        会議録(第1号)（PDF：554.2キロバイト）
      </a>
    `;

    const result = parseDetailPage(
      html,
      "令和6年第5回氷川町議会定例会会議録",
      "https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/index.html",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/3_6193_5726_up_ubwtka57.pdf",
    );
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>No PDF links</p>";
    expect(
      parseDetailPage(html, "テスト", "https://example.com/detail"),
    ).toEqual([]);
  });
});
