import { describe, expect, it } from "vitest";
import { parseListPage, parseDetailPage } from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年1月 定例会")).toBe(2024);
    expect(parseWarekiYear("令和元年9月 定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年12月 定例会")).toBe(2018);
    expect(parseWarekiYear("平成25年3月 定例会")).toBe(2013);
    expect(parseWarekiYear("平成元年4月 定例会")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和6年3月 定例会　会議録")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和8年1月 臨時会　会議録")).toBe(
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
          2025年3月10日更新
          <a href="https://www.town.kouhoku.saga.jp/kiji0032806/index.html">
            令和7年3月 定例会　会議録
          </a>
        </li>
        <li>
          2025年1月20日更新
          <a href="https://www.town.kouhoku.saga.jp/kiji0032800/index.html">
            令和7年1月 臨時会　会議録
          </a>
        </li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和7年3月 定例会 会議録",
      url: "https://www.town.kouhoku.saga.jp/kiji0032806/index.html",
    });
    expect(result[1]).toEqual({
      title: "令和7年1月 臨時会 会議録",
      url: "https://www.town.kouhoku.saga.jp/kiji0032800/index.html",
    });
  });

  it("相対パスを絶対URLに変換する", () => {
    const html = `
      <a href="/kiji0032806/index.html">令和7年3月 定例会　会議録</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(
      "https://www.town.kouhoku.saga.jp/kiji0032806/index.html",
    );
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/kiji0032806/index.html">令和7年3月 定例会</a>
      <a href="/kiji0032806/index.html">令和7年3月 定例会（重複）</a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
  });

  it("プロトコル相対URLを絶対URLに変換する", () => {
    const html = `
      <a href="//www.town.kouhoku.saga.jp/kiji003775/index.html">令和6年9月 定例会</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(
      "https://www.town.kouhoku.saga.jp/kiji003775/index.html",
    );
  });

  it("https://とプロトコル相対URLが同じページを指す場合は重複除去する", () => {
    const html = `
      <a href="https://www.town.kouhoku.saga.jp/kiji003775/index.html">令和6年9月 定例会</a>
      <a href="//www.town.kouhoku.saga.jp/kiji003775/index.html">令和6年9月 定例会（重複）</a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("会議録・定例会・臨時会を含まないリンクをナビゲーションとして除外する", () => {
    const html = `
      <a href="/kiji003626/index.html">印鑑登録</a>
      <a href="/kiji0031481/index.html">本人通知制度</a>
      <a href="https://www.town.kouhoku.saga.jp/kiji0032786/index.html">令和6年12月 定例会　会議録</a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年12月 定例会 会議録");
  });
});

describe("parseDetailPage", () => {
  it("詳細ページからPDFリンクを抽出する", () => {
    const html = `
      <a href="https://www.town.kouhoku.saga.jp/kiji0032963/3_2963_6897_up_0rkb5mqt.pdf">
        会期日程（PDF：100キロバイト）
      </a>
      <a href="https://www.town.kouhoku.saga.jp/kiji0032963/3_2963_6898_up_opyw3kgh.pdf">
        会議録本文（PDF：500キロバイト）
      </a>
    `;

    const result = parseDetailPage(
      html,
      "令和8年1月 臨時会　会議録",
      "https://www.town.kouhoku.saga.jp/kiji0032963/index.html",
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和8年1月 臨時会　会議録",
      pdfUrl:
        "https://www.town.kouhoku.saga.jp/kiji0032963/3_2963_6897_up_0rkb5mqt.pdf",
      pdfLabel: "会期日程",
      meetingType: "extraordinary",
      detailPageUrl:
        "https://www.town.kouhoku.saga.jp/kiji0032963/index.html",
    });
    expect(result[1]!.pdfLabel).toBe("会議録本文");
  });

  it("相対パスのPDFリンクを絶対URLに変換する", () => {
    const html = `
      <a href="/kiji0032963/3_2963_6897_up_0rkb5mqt.pdf">
        会期日程（PDF：100キロバイト）
      </a>
    `;

    const result = parseDetailPage(
      html,
      "令和8年1月 臨時会　会議録",
      "https://www.town.kouhoku.saga.jp/kiji0032963/index.html",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kouhoku.saga.jp/kiji0032963/3_2963_6897_up_0rkb5mqt.pdf",
    );
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>No PDF links</p>";
    expect(
      parseDetailPage(html, "テスト", "https://example.com/detail"),
    ).toEqual([]);
  });
});
