import { describe, expect, it } from "vitest";
import { parseTopListPage, parseYearListPage, parseDetailPage } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第7回(12月)定例会会議録")).toBe(2024);
    expect(parseWarekiYear("令和7年第1回(1月)臨時会会議録")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回定例会会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第4回定例会会議録")).toBe(2018);
    expect(parseWarekiYear("平成23年第1回臨時会会議録")).toBe(2011);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和6年第7回(12月)定例会会議録")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和6年第6回(11月)臨時会会議録")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会会議録")).toBe("committee");
  });
});

describe("parseTopListPage", () => {
  it("年度別一覧ページのURLを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list7-93.html">令和7年</a></li>
        <li><a href="/site/gikai/list7-92.html">令和6年</a></li>
        <li><a href="/site/gikai/list7-95.html">令和5年</a></li>
      </ul>
    `;

    const result = parseTopListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://www.town.tabuse.lg.jp/site/gikai/list7-93.html");
    expect(result[1]).toBe("https://www.town.tabuse.lg.jp/site/gikai/list7-92.html");
    expect(result[2]).toBe("https://www.town.tabuse.lg.jp/site/gikai/list7-95.html");
  });

  it("重複URLを除外する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list7-93.html">令和7年</a></li>
        <li><a href="/site/gikai/list7-93.html">令和7年（再掲）</a></li>
      </ul>
    `;

    const result = parseTopListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.tabuse.lg.jp/site/gikai/list7-93.html");
  });

  it("list7-{ID}.html 以外のリンクは無視する", () => {
    const html = `
      <a href="/site/gikai/list7.html">一覧に戻る</a>
      <a href="/site/gikai/list7-93.html">令和7年</a>
      <a href="/about/index.html">お問い合わせ</a>
      <a href="/site/gikai/7029.html">詳細ページ</a>
    `;

    const result = parseTopListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.tabuse.lg.jp/site/gikai/list7-93.html");
  });

  it("年度別リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseTopListPage(html)).toEqual([]);
  });
});

describe("parseYearListPage", () => {
  const yearListUrl = "https://www.town.tabuse.lg.jp/site/gikai/list7-92.html";

  it("詳細ページのURLを抽出する", () => {
    const html = `
      <ul>
        <li>
          <span class="article_date">2024/12/25</span>
          <span class="article_title"><a href="/site/gikai/7029.html">令和6年会議録について</a></span>
        </li>
      </ul>
    `;

    const result = parseYearListPage(html, yearListUrl);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.tabuse.lg.jp/site/gikai/7029.html");
  });

  it("list7-{ID}.html は除外する", () => {
    const html = `
      <a href="/site/gikai/list7-91.html">前の年度</a>
      <a href="/site/gikai/7029.html">令和6年会議録</a>
    `;

    const result = parseYearListPage(html, yearListUrl);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.tabuse.lg.jp/site/gikai/7029.html");
  });

  it("詳細ページURLがない場合は空配列を返す", () => {
    const html = "<p>準備中</p>";
    expect(parseYearListPage(html, yearListUrl)).toEqual([]);
  });
});

describe("parseDetailPage", () => {
  const detailUrl = "https://www.town.tabuse.lg.jp/site/gikai/7029.html";

  it("PDFリンクとメタ情報を抽出する", () => {
    const html = `
      <html>
        <body>
          <h2>ダウンロード</h2>
          <ul class="file_list">
            <li><a href="/uploaded/attachment/12345.pdf">令和6年第7回(12月)定例会会議録 [PDFファイル／2.21MB]</a></li>
            <li><a href="/uploaded/attachment/12346.pdf">令和6年第5回(9月)定例会会議録 [PDFファイル／2.03MB]</a></li>
          </ul>
        </body>
      </html>
    `;

    const result = parseDetailPage(html, detailUrl);

    expect(result.pdfs).toHaveLength(2);
    expect(result.pdfs[0]!.url).toBe("https://www.town.tabuse.lg.jp/uploaded/attachment/12345.pdf");
    expect(result.pdfs[0]!.title).toBe("令和6年第7回(12月)定例会会議録");
    expect(result.pdfs[0]!.year).toBe(2024);
    expect(result.pdfs[0]!.meetingType).toBe("plenary");
    expect(result.pdfs[1]!.url).toBe("https://www.town.tabuse.lg.jp/uploaded/attachment/12346.pdf");
    expect(result.pdfs[1]!.year).toBe(2024);
  });

  it("臨時会のmeetingTypeを正しく検出する", () => {
    const html = `
      <html>
        <body>
          <ul class="file_list">
            <li><a href="/uploaded/attachment/11111.pdf">令和6年第6回(11月)臨時会会議録 [PDFファイル／319KB]</a></li>
          </ul>
        </body>
      </html>
    `;

    const result = parseDetailPage(html, detailUrl);

    expect(result.pdfs).toHaveLength(1);
    expect(result.pdfs[0]!.meetingType).toBe("extraordinary");
    expect(result.pdfs[0]!.title).toBe("令和6年第6回(11月)臨時会会議録");
  });

  it("PDFリンクがない場合はpdfsが空配列になる", () => {
    const html = `
      <html>
        <body>
          <p>田布施町議会の会議録をPDFファイルでご覧いただけます。</p>
        </body>
      </html>
    `;

    const result = parseDetailPage(html, detailUrl);

    expect(result.pdfs).toHaveLength(0);
  });

  it("和暦を含まないPDFリンクは無視する", () => {
    const html = `
      <html>
        <body>
          <ul class="file_list">
            <li><a href="/uploaded/attachment/99999.pdf">参考資料 [PDFファイル／100KB]</a></li>
            <li><a href="/uploaded/attachment/12345.pdf">令和6年第7回(12月)定例会会議録 [PDFファイル／2.21MB]</a></li>
          </ul>
        </body>
      </html>
    `;

    const result = parseDetailPage(html, detailUrl);

    expect(result.pdfs).toHaveLength(1);
    expect(result.pdfs[0]!.year).toBe(2024);
  });
});
