import { describe, expect, it } from "vitest";
import {
  parseArticlePage,
  parseCategoryPage,
  parseHeldOnFromText,
  parseSessionNumber,
} from "./list";

describe("parseCategoryPage", () => {
  it("c-00-admininfo/c-03/c-03-02/{記事ID} パターンのリンクを抽出する", () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="https://www.vill.nishimera.lg.jp/village/c-00-admininfo/c-03/c-03-02/10006493">令和6年議事録</a></li>
          <li><a href="https://www.vill.nishimera.lg.jp/village/c-00-admininfo/c-03/c-03-02/10005758">令和5年議事録</a></li>
          <li><a href="https://www.vill.nishimera.lg.jp/village/c-00-admininfo/c-03/c-03-02/10004399">令和3年議事録</a></li>
        </ul>
      </body></html>
    `;

    const links = parseCategoryPage(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.articleId).toBe("10006493");
    expect(links[0]!.url).toBe(
      "https://www.vill.nishimera.lg.jp/village/c-00-admininfo/c-03/c-03-02/10006493",
    );
    expect(links[1]!.articleId).toBe("10005758");
    expect(links[2]!.articleId).toBe("10004399");
  });

  it("重複した記事 ID は除去する", () => {
    const html = `
      <a href="/village/c-00-admininfo/c-03/c-03-02/10006493">令和6年</a>
      <a href="/village/c-00-admininfo/c-03/c-03-02/10006493">令和6年（再掲）</a>
    `;

    const links = parseCategoryPage(html);
    expect(links).toHaveLength(1);
  });

  it("相対 URL を絶対 URL に変換する", () => {
    const html = `
      <a href="/village/c-00-admininfo/c-03/c-03-02/10006493">令和6年</a>
    `;

    const links = parseCategoryPage(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe(
      "https://www.vill.nishimera.lg.jp/village/c-00-admininfo/c-03/c-03-02/10006493",
    );
  });

  it("c-03-02 パターン以外のリンクはスキップする", () => {
    const html = `
      <a href="https://www.vill.nishimera.lg.jp/village/c-00-admininfo/c-03/c-03-02/10006493">議事録</a>
      <a href="https://www.vill.nishimera.lg.jp/other/path/123">その他</a>
    `;

    const links = parseCategoryPage(html);
    expect(links).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const links = parseCategoryPage(html);
    expect(links).toHaveLength(0);
  });
});

describe("parseArticlePage", () => {
  it("wp-content/uploads/ 配下の PDF リンクを抽出する", () => {
    const html = `
      <html><body>
        <div class="entry-content">
          <ul>
            <li><a href="https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/03/abc123.pdf">令和6年第1回定例会 1日目</a></li>
            <li><a href="https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/03/def456.pdf">令和6年第1回定例会 4日目</a></li>
            <li><a href="https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/07/ghi789.pdf">令和6年臨時会</a></li>
          </ul>
        </div>
      </body></html>
    `;

    const articleUrl =
      "https://www.vill.nishimera.lg.jp/village/c-00-admininfo/c-03/c-03-02/10006493";
    const meetings = parseArticlePage(html, articleUrl, 2024);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/03/abc123.pdf",
    );
    expect(meetings[0]!.linkText).toBe("令和6年第1回定例会 1日目");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.articleUrl).toBe(articleUrl);

    expect(meetings[2]!.meetingType).toBe("extraordinary");
  });

  it("相対 URL を絶対 URL に変換する", () => {
    const html = `
      <a href="/village/wp-content/uploads/2024/03/abc123.pdf">令和6年第1回定例会</a>
    `;

    const meetings = parseArticlePage(html, "https://example.com/article", 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toMatch(
      /^https:\/\/www\.vill\.nishimera\.lg\.jp/,
    );
  });

  it("重複 URL は除去する", () => {
    const html = `
      <a href="https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/03/dup.pdf">定例会</a>
      <a href="https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/03/dup.pdf">定例会（再掲）</a>
    `;

    const meetings = parseArticlePage(html, "https://example.com/article", 2024);
    expect(meetings).toHaveLength(1);
  });

  it("wp-content/uploads/ を含まない PDF リンクはスキップする", () => {
    const html = `
      <a href="/other/path/doc.pdf">その他資料</a>
      <a href="https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/03/valid.pdf">定例会</a>
    `;

    const meetings = parseArticlePage(html, "https://example.com/article", 2024);
    expect(meetings).toHaveLength(1);
  });

  it("リンクテキストが空の場合はスキップする", () => {
    const html = `
      <a href="https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/03/empty.pdf">   </a>
      <a href="https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/03/valid.pdf">定例会</a>
    `;

    const meetings = parseArticlePage(html, "https://example.com/article", 2024);
    expect(meetings).toHaveLength(1);
  });

  it("委員会の会議タイプを正しく検出する", () => {
    const html = `
      <a href="https://www.vill.nishimera.lg.jp/village/wp-content/uploads/2024/06/abc.pdf">総務委員会</a>
    `;

    const meetings = parseArticlePage(html, "https://example.com/article", 2024);
    expect(meetings[0]!.meetingType).toBe("committee");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>PDF なし</p></body></html>`;
    const meetings = parseArticlePage(html, "https://example.com/article", 2024);
    expect(meetings).toHaveLength(0);
  });
});

describe("parseHeldOnFromText", () => {
  it("令和年月日パターンを処理する", () => {
    expect(parseHeldOnFromText("令和6年3月4日開会", 2024)).toBe("2024-03-04");
  });

  it("令和元年パターンを処理する", () => {
    expect(parseHeldOnFromText("令和元年6月10日", 2019)).toBe("2019-06-10");
  });

  it("N月N日パターンを年情報と組み合わせて処理する", () => {
    expect(parseHeldOnFromText("3月4日", 2024)).toBe("2024-03-04");
  });

  it("全角数字を処理する", () => {
    expect(parseHeldOnFromText("令和６年３月４日", 2024)).toBe("2024-03-04");
  });

  it("日付情報がない場合は null を返す", () => {
    expect(parseHeldOnFromText("第1回定例会", 2024)).toBeNull();
  });
});

describe("parseSessionNumber", () => {
  it("第N回を抽出する", () => {
    expect(parseSessionNumber("令和6年第1回定例会")).toBe("第1回");
    expect(parseSessionNumber("令和6年第3回定例会 1日目")).toBe("第3回");
  });

  it("全角数字を処理する", () => {
    expect(parseSessionNumber("令和6年第１回定例会")).toBe("第1回");
  });

  it("回次がない場合は null を返す", () => {
    expect(parseSessionNumber("令和6年臨時会")).toBeNull();
  });
});
