import { describe, expect, it } from "vitest";
import { parseTopPage, parseYearPage } from "./list";

describe("192112-fuefuki/list", () => {
  it("トップページから年度別 URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gikai/shisejoho/shigikai/gijiroku/2026.html">2026年議会議事録</a></li>
        <li><a href="/gikai/shisejoho/shigikai/gijiroku/2025.html">2025年議会議事録</a></li>
        <li><a href="/gikai/shisejoho/shigikai/gijiroku/2025.html">2025年議会議事録</a></li>
      </ul>
    `;

    expect(parseTopPage(html, "https://www.city.fuefuki.yamanashi.jp/shisejoho/shigikai/gijiroku/index.html")).toEqual([
      "https://www.city.fuefuki.yamanashi.jp/gikai/shisejoho/shigikai/gijiroku/2026.html",
      "https://www.city.fuefuki.yamanashi.jp/gikai/shisejoho/shigikai/gijiroku/2025.html",
    ]);
  });

  it("年度別ページから会議一覧を抽出する", () => {
    const html = `
      <h2>1月&nbsp;令和7年笛吹市議会第1回臨時会</h2>
      <p><a href="/documents/11507/r7rinnjikaigijiroku.pdf" class="icon_pdf">令和7年笛吹市議会第1回臨時会（PDF：286KB）</a></p>
      <h2>2月 令和7年笛吹市議会第1回定例会</h2>
      <p><a href="/documents/11507/r71gijiroku.pdf" class="icon_pdf">令和7年笛吹市議会第1回定例会（PDF：2,004KB）</a></p>
    `;

    expect(parseYearPage(html)).toEqual([
      {
        pdfUrl: "https://www.city.fuefuki.yamanashi.jp/documents/11507/r7rinnjikaigijiroku.pdf",
        title: "令和7年笛吹市議会第1回臨時会",
        meetingType: "extraordinary",
      },
      {
        pdfUrl: "https://www.city.fuefuki.yamanashi.jp/documents/11507/r71gijiroku.pdf",
        title: "令和7年笛吹市議会第1回定例会",
        meetingType: "plenary",
      },
    ]);
  });

  it("PDF 以外のリンクは抽出しない", () => {
    const html = `
      <h2>2月 令和7年笛吹市議会第1回定例会</h2>
      <p><a href="/documents/11507/test.pdf" class="icon_pdf">令和7年笛吹市議会第1回定例会（PDF：2,004KB）</a></p>
      <h2>その他</h2>
      <p><a href="/shisejoho/shigikai/index.html">市議会トップ</a></p>
    `;

    expect(parseYearPage(html)).toHaveLength(1);
  });
});
