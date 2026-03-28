import { describe, expect, it } from "vitest";
import { buildListPageUrl, parseListPage } from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を西暦に変換する", () => {
    expect(parseWarekiYear("令和7年9月葛尾村議会定例会の結果について")).toBe(2025);
  });

  it("令和元年を西暦に変換する", () => {
    expect(parseWarekiYear("令和元年第1回葛尾村議会臨時会")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(parseWarekiYear("平成30年第4回葛尾村議会臨時会")).toBe(2018);
  });

  it("和暦がない場合は null を返す", () => {
    expect(parseWarekiYear("葛尾村議会だより")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和7年9月葛尾村議会定例会")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和6年第1回葛尾村議会臨時会")).toBe("extraordinary");
  });
});

describe("buildListPageUrl", () => {
  it("1ページ目はトップ URL を返す", () => {
    expect(buildListPageUrl("https://www.katsurao.org/site/gikai/", 1)).toBe(
      "https://www.katsurao.org/site/gikai/",
    );
  });

  it("2ページ目以降は index-N.html を返す", () => {
    expect(buildListPageUrl("https://www.katsurao.org/site/gikai/", 2)).toBe(
      "https://www.katsurao.org/site/gikai/index-2.html",
    );
  });
});

describe("parseListPage", () => {
  it("会議結果ページだけを抽出する", () => {
    const html = `
      <ul>
        <li>
          <span class="article_title">
            <a href="/site/gikai/teirei-kekka0709.html">令和7年9月葛尾村議会定例会の結果について</a>
          </span>
        </li>
        <li>
          <span class="article_title">
            <a href="/site/gikai/r06-01-rinji-kekka.html">令和6年第1回葛尾村議会臨時会の結果について</a>
          </span>
        </li>
        <li>
          <span class="article_title">
            <a href="/site/gikai/gikai-08.html">議会だより</a>
          </span>
        </li>
      </ul>
    `;

    const refs = parseListPage(html);

    expect(refs).toHaveLength(2);
    expect(refs[0]!.pageUrl).toBe("https://www.katsurao.org/site/gikai/teirei-kekka0709.html");
    expect(refs[0]!.articleTitle).toBe("令和7年9月葛尾村議会定例会の結果について");
    expect(refs[0]!.year).toBe(2025);
    expect(refs[1]!.pageUrl).toBe("https://www.katsurao.org/site/gikai/r06-01-rinji-kekka.html");
    expect(refs[1]!.year).toBe(2024);
  });

  it("重複する URL は一度だけ返す", () => {
    const html = `
      <a href="/site/gikai/teirei-kekka0709.html">令和7年9月葛尾村議会定例会の結果について</a>
      <a href="/site/gikai/teirei-kekka0709.html">令和7年9月葛尾村議会定例会の結果について</a>
    `;

    const refs = parseListPage(html);

    expect(refs).toHaveLength(1);
    expect(refs[0]!.pageUrl).toBe("https://www.katsurao.org/site/gikai/teirei-kekka0709.html");
  });

  it("和暦年を含まない結果ページはスキップする", () => {
    const html = `
      <a href="/site/gikai/sample.html">葛尾村議会定例会の結果について</a>
    `;

    expect(parseListPage(html)).toEqual([]);
  });
});
