import { describe, it, expect } from "vitest";
import { parseYearPageUrls, parseYearPage, extractYearFromPageTitle } from "./list";

describe("parseYearPageUrls", () => {
  it("年度別ページの URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/gikai/1/kaigiroku/2859.html">令和6年議会の会議録</a></li>
        <li><a href="/soshiki/gikai/1/kaigiroku/2615.html">令和5年議会の会議録</a></li>
        <li><a href="/soshiki/gikai/1/kaigiroku/2233.html">予算・決算特別委員会会議録</a></li>
      </ul>
    `;

    const urls = parseYearPageUrls(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.town.shikama.miyagi.jp/soshiki/gikai/1/kaigiroku/2859.html");
    expect(urls[1]).toBe("https://www.town.shikama.miyagi.jp/soshiki/gikai/1/kaigiroku/2615.html");
    expect(urls[2]).toBe("https://www.town.shikama.miyagi.jp/soshiki/gikai/1/kaigiroku/2233.html");
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="/soshiki/gikai/1/kaigiroku/2859.html">リンク1</a>
      <a href="/soshiki/gikai/1/kaigiroku/2859.html">リンク2（重複）</a>
    `;

    const urls = parseYearPageUrls(html);
    expect(urls).toHaveLength(1);
  });

  it("年度ページ以外のリンクはスキップする", () => {
    const html = `
      <a href="/chosei/gikai/2363.html">会議録トップ</a>
      <a href="/soshiki/gikai/1/kaigiroku/2859.html">令和6年議会の会議録</a>
      <a href="/other/path/123.html">その他</a>
    `;

    const urls = parseYearPageUrls(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.shikama.miyagi.jp/soshiki/gikai/1/kaigiroku/2859.html");
  });

  it("リンクが存在しない場合は空配列を返す", () => {
    const html = `<p>リンクなし</p>`;
    expect(parseYearPageUrls(html)).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  const yearPageUrl = "https://www.town.shikama.miyagi.jp/soshiki/gikai/1/kaigiroku/2859.html";

  it("PDF リンクを抽出する", () => {
    const html = `
      <h2>令和6年議会の会議録</h2>
      <ul>
        <li>
          定例会12月
          <a href="/material/files/group/15/gijirokuR612-1.pdf">令和6年12月15日</a>
        </li>
        <li>
          定例会9月
          <a href="/material/files/group/15/gijirokuR609-1.pdf">令和6年9月10日</a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html, yearPageUrl);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shikama.miyagi.jp/material/files/group/15/gijirokuR612-1.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2024-12-15");
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.shikama.miyagi.jp/material/files/group/15/gijirokuR609-1.pdf"
    );
    expect(meetings[1]!.heldOn).toBe("2024-09-10");
  });

  it("委員会の PDF は meetingType が committee になる", () => {
    const html = `
      <h2>予算・決算特別委員会会議録</h2>
      <ul>
        <li>
          予算審査全員特別委員会
          <a href="/material/files/group/15/yosanR60310.pdf">令和6年3月10日</a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html, yearPageUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("committee");
    expect(meetings[0]!.heldOn).toBe("2024-03-10");
  });

  it("PDF 以外のリンクはスキップする", () => {
    const html = `
      <h2>令和6年議会の会議録</h2>
      <ul>
        <li><a href="/other/file.html">HTML ファイル</a></li>
        <li><a href="/material/files/group/15/gijirokuR612-1.pdf">令和6年12月15日</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, yearPageUrl);
    expect(meetings).toHaveLength(1);
  });

  it("令和元年の日付を正しく処理する", () => {
    const html = `
      <h2>令和元年議会の会議録</h2>
      <ul>
        <li><a href="/material/files/group/15/gijirokuR106-1.pdf">令和元年6月1日</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, yearPageUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-06-01");
  });

  it("プロトコル相対 URL (//) を正しく絶対 URL に変換する", () => {
    const html = `
      <h2>令和6年議会の会議録</h2>
      <ul>
        <li><a href="//www.town.shikama.miyagi.jp/material/files/group/15/gijirokuR612-1.pdf">令和6年12月15日</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, yearPageUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shikama.miyagi.jp/material/files/group/15/gijirokuR612-1.pdf"
    );
  });

  it("PDF がない場合は空配列を返す", () => {
    const html = `<h2>令和6年議会の会議録</h2><p>準備中</p>`;
    expect(parseYearPage(html, yearPageUrl)).toHaveLength(0);
  });
});

describe("extractYearFromPageTitle", () => {
  it("令和6年のページから2024を返す", () => {
    const html = `
      <h2>令和6年議会の会議録</h2>
      <p>令和6年の会議録一覧</p>
    `;
    expect(extractYearFromPageTitle(html)).toBe(2024);
  });

  it("令和7年のページから2025を返す", () => {
    const html = `<h2>令和7年議会の会議録</h2>`;
    expect(extractYearFromPageTitle(html)).toBe(2025);
  });

  it("令和元年のページから2019を返す", () => {
    const html = `<h2>令和元年議会の会議録</h2>`;
    expect(extractYearFromPageTitle(html)).toBe(2019);
  });

  it("全角数字も処理できる", () => {
    const html = `<h2>令和６年議会の会議録</h2>`;
    expect(extractYearFromPageTitle(html)).toBe(2024);
  });

  it("年度情報がない場合は null を返す", () => {
    const html = `<h2>予算・決算特別委員会会議録</h2>`;
    expect(extractYearFromPageTitle(html)).toBeNull();
  });
});
