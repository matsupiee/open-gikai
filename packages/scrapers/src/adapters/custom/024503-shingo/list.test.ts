import { describe, expect, it } from "vitest";
import { parseYearPage, parseYearPageUrls } from "./list";

describe("parseYearPageUrls", () => {
  it("トップページから年度別ページ URL を抽出する（実際の構造）", () => {
    const html = `
<!-- cont -->
<div id="cont">
  <h2>会議録</h2>
  <h6><a href="https://www.vill.shingo.aomori.jp/page-30802/">令和8年会議録 </a><span style="color: #ff0000;">New!</span></h6>
  <h6><a href="https://www.vill.shingo.aomori.jp/page-28901/">令和7年会議録 </a><span style="color: #ff0000;">New!</span></h6>
  <h6><a href="https://www.vill.shingo.aomori.jp/page-25971/page-27906/">令和6年会議録</a></h6>
  <h6><a href="https://www.vill.shingo.aomori.jp/page-27086/">令和5年会議録</a></h6>
  <h6><a href="https://www.vill.shingo.aomori.jp/page-25973/">令和4年会議録</a></h6>
</div>
<!-- end cont -->
    `;

    const pages = parseYearPageUrls(html);

    expect(pages).toHaveLength(5);
    expect(pages[0]!.url).toBe("https://www.vill.shingo.aomori.jp/page-30802/");
    expect(pages[0]!.year).toBe(2026);
    expect(pages[1]!.url).toBe("https://www.vill.shingo.aomori.jp/page-28901/");
    expect(pages[1]!.year).toBe(2025);
    expect(pages[2]!.url).toBe("https://www.vill.shingo.aomori.jp/page-25971/page-27906/");
    expect(pages[2]!.year).toBe(2024);
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
<!-- cont -->
<div id="cont">
  <h6><a href="https://www.vill.shingo.aomori.jp/page-30802/">令和8年会議録</a></h6>
  <h6><a href="https://www.vill.shingo.aomori.jp/page-123/">議会だより</a></h6>
</div>
<!-- end cont -->
    `;

    const pages = parseYearPageUrls(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.year).toBe(2026);
  });

  it("<!-- cont --> がない場合は全体を対象にする（フォールバック）", () => {
    const html = `<h6><a href="/page-1/">令和7年会議録</a></h6>`;
    const pages = parseYearPageUrls(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.year).toBe(2025);
  });

  it("令和元年を正しくパースする", () => {
    const html = `
<!-- cont -->
<div id="cont">
  <h6><a href="https://www.vill.shingo.aomori.jp/page-100/">令和元年会議録</a></h6>
</div>
<!-- end cont -->
    `;

    const pages = parseYearPageUrls(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.year).toBe(2019);
  });
});

describe("parseYearPage", () => {
  it("令和4〜6年形式: p > a タグから PDF リンクを抽出する", () => {
    const html = `
<!-- cont -->
<div id="cont">
  <p><a href="https://www.vill.shingo.aomori.jp/common/media/2024/03/abc123.pdf">令和６年第１回定例会（令和６年３月１日～３月８日）（PDF）</a></p>
  <p><a href="https://www.vill.shingo.aomori.jp/common/media/2024/06/def456.pdf">令和６年第２回定例会（令和６年６月１日）（PDF）</a></p>
</div>
<!-- end cont -->
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.shingo.aomori.jp/common/media/2024/03/abc123.pdf"
    );
    expect(meetings[0]!.title).toBe(
      "令和６年第１回定例会（令和６年３月１日～３月８日）"
    );
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[1]!.title).toBe("令和６年第２回定例会（令和６年６月１日）");
  });

  it("令和7〜8年形式: li > a タグから PDF リンクを抽出する", () => {
    const html = `
<!-- cont -->
<div id="cont">
  <ul>
    <li><a href="https://www.vill.shingo.aomori.jp/common/media/2025/01/xyz789.pdf">令和7年第1回臨時会（令和7年1月23日）</a></li>
    <li><a href="https://www.vill.shingo.aomori.jp/common/media/2025/03/pqr012.pdf">令和7年第1回定例会（令和7年3月1日）</a></li>
  </ul>
</div>
<!-- end cont -->
    `;

    const meetings = parseYearPage(html, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和7年第1回臨時会（令和7年1月23日）");
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[1]!.title).toBe("令和7年第1回定例会（令和7年3月1日）");
  });

  it("定例会・臨時会を含まないリンクはスキップする", () => {
    const html = `
<!-- cont -->
<div id="cont">
  <p><a href="https://www.vill.shingo.aomori.jp/common/media/2024/01/aaa.pdf">令和６年第１回定例会（PDF）</a></p>
  <p><a href="https://www.vill.shingo.aomori.jp/images/logo.pdf">ロゴ</a></p>
</div>
<!-- end cont -->
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和６年第１回定例会");
  });

  it("タイトルに和暦が含まれる場合は年を抽出する", () => {
    const html = `
<!-- cont -->
<div id="cont">
  <p><a href="https://www.vill.shingo.aomori.jp/common/media/2024/03/abc.pdf">令和６年第１回定例会（PDF）</a></p>
</div>
<!-- end cont -->
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings[0]!.year).toBe(2024);
  });

  it("期待年をデフォルトとして使用する（タイトルに年なし）", () => {
    const html = `
<!-- cont -->
<div id="cont">
  <p><a href="https://www.vill.shingo.aomori.jp/common/media/2021/03/abc.pdf">第１回定例会（PDF）</a></p>
</div>
<!-- end cont -->
    `;

    const meetings = parseYearPage(html, 2021);
    expect(meetings[0]!.year).toBe(2021);
  });

  it("<!-- cont --> 外のリンクは含まれない", () => {
    const html = `
      <div id="sidebar">
        <a href="https://www.vill.shingo.aomori.jp/common/media/2024/01/sidebar.pdf">令和６年第１回定例会（PDF）</a>
      </div>
<!-- cont -->
<div id="cont">
  <p><a href="https://www.vill.shingo.aomori.jp/common/media/2024/03/main.pdf">令和６年第２回定例会（PDF）</a></p>
</div>
<!-- end cont -->
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("main.pdf");
  });

  it("URL の末尾の全角スペースをトリムする", () => {
    const html = `
<!-- cont -->
<div id="cont">
  <p><a href="https://www.vill.shingo.aomori.jp/common/media/2024/03/abc.pdf　">令和６年第１回定例会（PDF）</a></p>
</div>
<!-- end cont -->
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.shingo.aomori.jp/common/media/2024/03/abc.pdf"
    );
  });
});
