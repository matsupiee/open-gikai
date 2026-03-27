import { describe, expect, it } from "vitest";
import { parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクと西暦年候補を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/12665.htm">令和8年議会会議録</a></li>
        <li><a href="/12269.htm">令和７年議会会議録</a></li>
        <li><a href="/6683.htm">平成31年・令和元年議会会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.url).toBe("https://www.town.fukushima-futaba.lg.jp/12665.htm");
    expect(pages[0]!.years).toEqual([2026]);
    expect(pages[1]!.years).toEqual([2025]);
    expect(pages[2]!.years).toEqual([2019]);
  });

  it("会議録以外のリンクは除外する", () => {
    const html = `
      <a href="/news.htm">お知らせ</a>
      <a href="/12269.htm">令和７年議会会議録</a>
    `;

    expect(parseTopPage(html)).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  const pageUrl = "https://www.town.fukushima-futaba.lg.jp/12269.htm";

  it("年度ページから PDF リンクを抽出し、ファイルサイズ表記を除去する", () => {
    const html = `
      <p><a href="/secure/16851/03.pdf">令和７年第１回定例会会議録（３月）(6.0MB)</a></p>
      <p><a href="/secure/16851/202502.pdf">令和７年第１回臨時会会議録（２月）(477KB)</a></p>
    `;

    const meetings = parseYearPage(html, pageUrl);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和７年第１回定例会会議録（３月）");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.fukushima-futaba.lg.jp/secure/16851/03.pdf",
    );
    expect(meetings[1]!.title).toBe("令和７年第１回臨時会会議録（２月）");
  });

  it("同一 PDF への分割リンクを結合する", () => {
    const html = `
      <p>
        <a href="/secure/16851/202507.pdf">令和７年第２回定例会会議録（６月）(6.2M</a>
        <a href="/secure/16851/202507.pdf">B)</a>
      </p>
    `;

    const meetings = parseYearPage(html, pageUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和７年第２回定例会会議録（６月）");
  });
});
