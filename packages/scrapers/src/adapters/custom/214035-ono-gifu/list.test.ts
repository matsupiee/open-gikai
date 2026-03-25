import { describe, it, expect } from "vitest";
import { parseTopPageForNewsletterLinks, parseNewsletterPage } from "./list";

describe("parseTopPageForNewsletterLinks", () => {
  it("議会だより（一般質問）の年度別ページリンクを抽出する", () => {
    const html = `
      <div class="nav">
        <ul>
          <li><a href="https://www.town-ono.jp/0000002406.html">議会だより（一般質問・令和7年）</a></li>
          <li><a href="https://www.town-ono.jp/0000002234.html">議会だより（一般質問・令和6年）</a></li>
          <li><a href="https://www.town-ono.jp/0000002045.html">議会だより（一般質問・令和5年）</a></li>
        </ul>
      </div>
    `;

    const links = parseTopPageForNewsletterLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.url).toBe("https://www.town-ono.jp/0000002406.html");
    expect(links[0]!.label).toBe("議会だより（一般質問・令和7年）");
    expect(links[1]!.url).toBe("https://www.town-ono.jp/0000002234.html");
    expect(links[2]!.url).toBe("https://www.town-ono.jp/0000002045.html");
  });

  it("会議の結果リンクはスキップする", () => {
    const html = `
      <div>
        <a href="https://www.town-ono.jp/0000002542.html">会議の結果（令和8年）</a>
        <a href="https://www.town-ono.jp/0000002364.html">会議の結果（令和7年）</a>
        <a href="https://www.town-ono.jp/0000002406.html">議会だより（一般質問・令和7年）</a>
      </div>
    `;

    const links = parseTopPageForNewsletterLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.label).toBe("議会だより（一般質問・令和7年）");
  });

  it("同じ URL が複数回出現しても重複しない", () => {
    const html = `
      <div>
        <a href="https://www.town-ono.jp/0000002406.html">議会だより（一般質問・令和7年）</a>
        <a href="https://www.town-ono.jp/0000002406.html">議会だより（一般質問・令和7年）</a>
      </div>
    `;

    const links = parseTopPageForNewsletterLinks(html);
    expect(links).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div><p>準備中です</p></div>`;
    const links = parseTopPageForNewsletterLinks(html);
    expect(links).toHaveLength(0);
  });

  it("相対パスのリンクを絶対 URL に変換する", () => {
    const html = `
      <div>
        <a href="/0000002406.html">議会だより（一般質問・令和7年）</a>
      </div>
    `;

    const links = parseTopPageForNewsletterLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe("https://www.town-ono.jp/0000002406.html");
  });
});

describe("parseNewsletterPage", () => {
  it("対象年の PDF リンクを抽出する", () => {
    const html = `
      <div class="content">
        <p><a href="./cmsfiles/contents/0000002/2406/r07ippansitumon1.pdf">令和7年第1回定例会(PDF,1.77MB)</a></p>
        <p><a href="./cmsfiles/contents/0000002/2406/r07ippansitumon2.pdf">令和7年第2回定例会(PDF,1.83MB)</a></p>
        <p><a href="./cmsfiles/contents/0000002/2406/r07ippansitumon3.pdf">令和7年第3回定例会(PDF,2.31MB)</a></p>
        <p><a href="./cmsfiles/contents/0000002/2406/r07ippansitumon4.pdf">令和7年第4回定例会(PDF,2.34MB)</a></p>
      </div>
    `;

    const pageUrl = "https://www.town-ono.jp/0000002406.html";
    const meetings = parseNewsletterPage(html, pageUrl, 2025);

    expect(meetings).toHaveLength(4);
    expect(meetings[0]!.pdfUrl).toBe("https://www.town-ono.jp/cmsfiles/contents/0000002/2406/r07ippansitumon1.pdf");
    expect(meetings[0]!.title).toBe("令和7年第1回定例会(PDF,1.77MB)");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.heldOn).toBeNull();
    expect(meetings[1]!.pdfUrl).toBe("https://www.town-ono.jp/cmsfiles/contents/0000002/2406/r07ippansitumon2.pdf");
  });

  it("対象年以外はスキップする", () => {
    const html = `
      <div>
        <p><a href="./cmsfiles/contents/0000002/2406/r07ippansitumon1.pdf">令和7年第1回定例会</a></p>
        <p><a href="./cmsfiles/contents/0000002/2406/r07ippansitumon2.pdf">令和7年第2回定例会</a></p>
      </div>
    `;

    const pageUrl = "https://www.town-ono.jp/0000002406.html";
    const meetings = parseNewsletterPage(html, pageUrl, 2024);

    expect(meetings).toHaveLength(0);
  });

  it("臨時会の meetingType が extraordinary になる", () => {
    const html = `
      <div>
        <p><a href="./cmsfiles/contents/0000002/2234/r06ippansitumon_rinji.pdf">令和6年第1回臨時会</a></p>
      </div>
    `;

    const pageUrl = "https://www.town-ono.jp/0000002234.html";
    const meetings = parseNewsletterPage(html, pageUrl, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("定例会・臨時会を含まないリンクはスキップする", () => {
    const html = `
      <div>
        <p><a href="./cmsfiles/contents/0000002/2234/r06ippansitumon1.pdf">令和6年第1回定例会</a></p>
        <p><a href="./cmsfiles/contents/0000002/2234/annai.pdf">利用案内</a></p>
      </div>
    `;

    const pageUrl = "https://www.town-ono.jp/0000002234.html";
    const meetings = parseNewsletterPage(html, pageUrl, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年第1回定例会");
  });

  it("平成年度のリンクも正しく処理する", () => {
    const html = `
      <div>
        <p><a href="./cmsfiles/contents/0000002/793/h29ippansitumon1.pdf">平成29年第1回定例会</a></p>
      </div>
    `;

    const pageUrl = "https://www.town-ono.jp/0000000793.html";
    const meetings = parseNewsletterPage(html, pageUrl, 2017);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("平成29年第1回定例会");
    expect(meetings[0]!.pdfUrl).toBe("https://www.town-ono.jp/cmsfiles/contents/0000002/793/h29ippansitumon1.pdf");
  });

  it("令和元年のリンクも正しく処理する", () => {
    const html = `
      <div>
        <p><a href="./cmsfiles/contents/0000002/1024/r01ippansitumon1.pdf">令和元年第1回定例会</a></p>
      </div>
    `;

    const pageUrl = "https://www.town-ono.jp/0000001024.html";
    const meetings = parseNewsletterPage(html, pageUrl, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和元年第1回定例会");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div><p>準備中です</p></div>`;
    const pageUrl = "https://www.town-ono.jp/0000002406.html";
    const meetings = parseNewsletterPage(html, pageUrl, 2025);
    expect(meetings).toHaveLength(0);
  });
});
