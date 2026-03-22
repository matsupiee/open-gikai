import { describe, expect, it } from "vitest";
import { parseYearPageUrls, parseMeetingLinks } from "./list";

describe("parseYearPageUrls", () => {
  it("令和7年 (2025) の目次リンクを抽出する", () => {
    const html = `
      <a href="/site/gijiroku1/144988.html">令和7年分の目次</a>
      <a href="/site/gijiroku1/138068.html">令和7年分の目次</a>
      <a href="/site/gijiroku1/130558.html">令和6年分の目次</a>
    `;
    const urls = parseYearPageUrls(html, 2025);

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://www.city.ebetsu.hokkaido.jp/site/gijiroku1/144988.html");
    expect(urls[1]).toBe("https://www.city.ebetsu.hokkaido.jp/site/gijiroku1/138068.html");
  });

  it("平成31年/令和元年 (2019) の両方にマッチする", () => {
    const html = `
      <a href="/site/gijiroku1/67160.html">平成31年・令和元年分の目次</a>
      <a href="/site/gijiroku1/57607.html">平成30年分の目次</a>
    `;
    const urls = parseYearPageUrls(html, 2019);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.city.ebetsu.hokkaido.jp/site/gijiroku1/67160.html");
  });

  it("該当年がなければ空配列を返す", () => {
    const html = `<a href="/site/gijiroku1/144988.html">令和7年分の目次</a>`;
    const urls = parseYearPageUrls(html, 2030);

    expect(urls).toHaveLength(0);
  });

  it("目次でないリンクは除外する", () => {
    const html = `
      <a href="/site/gijiroku1/144862.html">令和7年2月20日（初日）</a>
    `;
    const urls = parseYearPageUrls(html, 2025);

    expect(urls).toHaveLength(0);
  });
});

describe("parseMeetingLinks", () => {
  it("年度ページから会議録リンクを抽出する", () => {
    const html = `
      <h2>第1回臨時会</h2>
      <ul>
        <li><a href="/site/gijiroku1/144858.html">令和7年1月16日</a></li>
      </ul>
      <h2>第1回定例会</h2>
      <ul>
        <li><a href="/site/gijiroku1/144862.html">令和7年2月20日（初日）</a></li>
        <li><a href="/site/gijiroku1/144889.html">令和7年3月3日（一般質問）</a></li>
      </ul>
    `;
    const records = parseMeetingLinks(html);

    expect(records).toHaveLength(3);
    expect(records[0]!.pageId).toBe("144858");
    expect(records[0]!.section).toBe("第1回臨時会");
    expect(records[1]!.pageId).toBe("144862");
    expect(records[1]!.section).toBe("第1回定例会");
    expect(records[2]!.title).toBe("令和7年3月3日（一般質問）");
  });

  it("目次・一覧リンクを除外する", () => {
    const html = `
      <a href="/site/gijiroku1/144988.html">令和7年分の目次</a>
      <a href="/site/gijiroku1/10000.html">委員会会議録の閲覧一覧</a>
      <a href="/site/gijiroku1/144862.html">令和7年2月20日</a>
    `;
    const records = parseMeetingLinks(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.pageId).toBe("144862");
  });

  it("重複する pageId を除外する", () => {
    const html = `
      <a href="/site/gijiroku1/144862.html">令和7年2月20日</a>
      <a href="/site/gijiroku1/144862.html">令和7年2月20日</a>
    `;
    const records = parseMeetingLinks(html);

    expect(records).toHaveLength(1);
  });
});
