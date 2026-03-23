import { describe, expect, it } from "vitest";
import {
  parseArticleLinks,
  parsePublishedDate,
  parsePdfUrl,
  isInYear,
  isAfterYear,
  resolveHeldOnYear,
} from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年議会だより")).toBe(2025);
    expect(parseWarekiYear("令和6年第1回定例会")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成25年第5回定例会(12月)")).toBe(2013);
    expect(parseWarekiYear("平成30年第4回定例会")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("議会だより上勝")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("平成25年第5回定例会(12月)")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和5年第1回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseArticleLinks", () => {
  it("more.html から記事リンクを抽出する", () => {
    const html = `
      <section>
        <div class="docs">
          <ul>
            <li>
              <span class="title_link"><a href="/gikai/docs/2014011600034/">平成25年第5回定例会(12月)</a></span>
              (<span class="publish_date">2013年12月20日</span> <span class="group">総務課</span>)
            </li>
            <li>
              <span class="title_link"><a href="/gikai/docs/2014011600033/">平成25年第4回定例会(9月)</a></span>
              (<span class="publish_date">2013年09月20日</span> <span class="group">総務課</span>)
            </li>
          </ul>
        </div>
      </section>
    `;

    const result = parseArticleLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      articleId: "2014011600034",
      title: "平成25年第5回定例会(12月)",
    });
    expect(result[1]).toEqual({
      articleId: "2014011600033",
      title: "平成25年第4回定例会(9月)",
    });
  });

  it("重複する articleId を除外する", () => {
    const html = `
      <a href="/gikai/docs/2014011600034/">平成25年第5回定例会(12月)</a>
      <a href="/gikai/docs/2014011600034/">平成25年第5回定例会(12月)</a>
    `;

    const result = parseArticleLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseArticleLinks(html)).toEqual([]);
  });

  it("タイトルの空白を正規化する", () => {
    const html = `<a href="/gikai/docs/2014011600034/">平成25年　第5回定例会</a>`;
    const result = parseArticleLinks(html);
    expect(result[0]!.title).toBe("平成25年 第5回定例会");
  });
});

describe("parsePublishedDate", () => {
  it("公開日を YYYY-MM-DD 形式で返す", () => {
    const html = `<p class="publishedAt">公開日 2013年12月20日</p>`;
    expect(parsePublishedDate(html)).toBe("2013-12-20");
  });

  it("月日が1桁の場合もゼロ埋めする", () => {
    const html = `<p class="publishedAt">公開日 2026年2月1日</p>`;
    expect(parsePublishedDate(html)).toBe("2026-02-01");
  });

  it("公開日が存在しない場合は null を返す", () => {
    const html = `<p>no date here</p>`;
    expect(parsePublishedDate(html)).toBeNull();
  });
});

describe("parsePdfUrl", () => {
  it("file_contents の相対 PDF リンクを絶対 URL に変換する", () => {
    const html = `
      <a class="iconFile iconPdf" href="file_contents/H25_teireikai_5th.pdf">
        平成25年第5回定例会（12月）.pdf(72.8KBytes)
      </a>
    `;
    const pageUrl = "http://www.kamikatsu.jp/gikai/docs/2014011600034/";

    expect(parsePdfUrl(html, pageUrl)).toBe(
      "http://www.kamikatsu.jp/gikai/docs/2014011600034/file_contents/H25_teireikai_5th.pdf"
    );
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `<p>No PDF here</p>`;
    expect(parsePdfUrl(html, "http://www.kamikatsu.jp/gikai/docs/123/")).toBeNull();
  });

  it("議会だよりの PDF リンクを抽出する", () => {
    const html = `
      <a class="iconFile iconPdf" href="file_contents/100.pdf">100.pdf[PDF：3.25MB]</a>
    `;
    const pageUrl = "http://www.kamikatsu.jp/gikai/docs/2026020100099/";

    expect(parsePdfUrl(html, pageUrl)).toBe(
      "http://www.kamikatsu.jp/gikai/docs/2026020100099/file_contents/100.pdf"
    );
  });
});

describe("isInYear", () => {
  it("対象年の publishedOn は true", () => {
    expect(isInYear("2013-12-20", 2013)).toBe(true);
  });

  it("翌年の publishedOn は false", () => {
    expect(isInYear("2014-01-01", 2013)).toBe(false);
  });

  it("前年の publishedOn は false", () => {
    expect(isInYear("2012-12-31", 2013)).toBe(false);
  });

  it("null は false", () => {
    expect(isInYear(null, 2013)).toBe(false);
  });
});

describe("isAfterYear", () => {
  it("翌年の publishedOn は true", () => {
    expect(isAfterYear("2014-01-01", 2013)).toBe(true);
  });

  it("同年の publishedOn は false", () => {
    expect(isAfterYear("2013-12-31", 2013)).toBe(false);
  });

  it("前年の publishedOn は false", () => {
    expect(isAfterYear("2012-12-31", 2013)).toBe(false);
  });

  it("null は false", () => {
    expect(isAfterYear(null, 2013)).toBe(false);
  });
});

describe("resolveHeldOnYear", () => {
  it("タイトルに令和が含まれる場合は西暦に変換する", () => {
    expect(resolveHeldOnYear("令和5年第4回定例会(12月)", "2023-12-20")).toBe(2023);
  });

  it("タイトルに平成が含まれる場合は西暦に変換する", () => {
    expect(resolveHeldOnYear("平成25年第5回定例会(12月)", "2013-12-20")).toBe(2013);
  });

  it("タイトルに和暦がない場合は publishedOn の年を返す", () => {
    expect(resolveHeldOnYear("議会だより上勝100号", "2026-02-01")).toBe(2026);
  });

  it("タイトルに和暦がなく publishedOn も null の場合は null を返す", () => {
    expect(resolveHeldOnYear("議会だより上勝100号", null)).toBeNull();
  });
});
