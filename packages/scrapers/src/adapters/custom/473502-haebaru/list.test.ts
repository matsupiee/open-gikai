import { describe, expect, it } from "vitest";
import {
  parseHeldOnFromLabel,
  parseMeetingPage,
  parseTopPage,
  parseYearPage,
} from "./list";

describe("parseTopPage", () => {
  it("年度一覧ページから会議録一覧ページを抽出する", () => {
    const html = `
      <ul>
        <li><span class="article_title"><a href="/site/gikai/15299.html">令和7年 会議録一覧</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/9145.html">令和6年 会議録一覧</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/list64-82.html">一般質問</a></span></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({
      label: "令和7年 会議録一覧",
      url: "https://www.town.haebaru.lg.jp/site/gikai/15299.html",
    });
    expect(pages[1]).toEqual({
      label: "令和6年 会議録一覧",
      url: "https://www.town.haebaru.lg.jp/site/gikai/9145.html",
    });
  });
});

describe("parseYearPage", () => {
  it("年度ページから会期ごとの詳細ページを抽出する", () => {
    const html = `
      <div class="detail_free">
        <p><a href="/soshiki/2/15300.html">第1回臨時会</a></p>
        <p><a href="/soshiki/2/15302.html">第1回定例会</a></p>
        <p><a href="/site/gikai/2007.html">一般質問通告書</a></p>
      </div>
    `;

    const pages = parseYearPage(html);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({
      title: "第1回臨時会",
      url: "https://www.town.haebaru.lg.jp/soshiki/2/15300.html",
    });
    expect(pages[1]).toEqual({
      title: "第1回定例会",
      url: "https://www.town.haebaru.lg.jp/soshiki/2/15302.html",
    });
  });
});

describe("parseHeldOnFromLabel", () => {
  it("添付ラベル先頭の月日から日付を組み立てる", () => {
    expect(parseHeldOnFromLabel("0625一般質問1", 2024)).toBe("2024-06-25");
    expect(parseHeldOnFromLabel("1218一般質問", 2024)).toBe("2024-12-18");
  });

  it("不正な日付は null を返す", () => {
    expect(parseHeldOnFromLabel("1332最終日", 2024)).toBeNull();
    expect(parseHeldOnFromLabel("一般質問", 2024)).toBeNull();
  });
});

describe("parseMeetingPage", () => {
  it("会議ページから PDF 一覧を抽出する", () => {
    const html = `
      <h1>令和6年第2回定例会 会議録</h1>
      <table>
        <tr>
          <td><a href="/uploaded/attachment/11302.pdf">0618 [PDFファイル／315KB]</a></td>
          <td><a href="/uploaded/attachment/11310.docx">0618 [Wordファイル／39KB]</a></td>
        </tr>
        <tr>
          <td><a href="/uploaded/attachment/11305.pdf">0625一般質問1 [PDFファイル／461KB]</a></td>
          <td><a href="/uploaded/attachment/11311.docx">0625一般質問1 [Wordファイル／71KB]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseMeetingPage(
      html,
      "https://www.town.haebaru.lg.jp/soshiki/2/9148.html",
      2024
    );

    expect(meetings).toHaveLength(2);
    expect(meetings[0]).toEqual({
      pdfUrl: "https://www.town.haebaru.lg.jp/uploaded/attachment/11302.pdf",
      title: "令和6年第2回定例会 0618",
      heldOn: "2024-06-18",
      sessionTitle: "令和6年第2回定例会",
    });
    expect(meetings[1]).toEqual({
      pdfUrl: "https://www.town.haebaru.lg.jp/uploaded/attachment/11305.pdf",
      title: "令和6年第2回定例会 0625一般質問1",
      heldOn: "2024-06-25",
      sessionTitle: "令和6年第2回定例会",
    });
  });
});
