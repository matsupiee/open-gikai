import { describe, expect, it } from "vitest";
import { parseArticlePage, parseListPage, parseYearPage } from "./list";

describe("parseListPage", () => {
  it("議事録一覧から年度別ページを抽出する", () => {
    const html = `
      <ul>
        <li><span class="article_title"><a href="/site/gikai/list32-218.html">令和7年定例会・臨時会</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/list32-205.html">令和6年定例会・臨時会</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/list32-118.html">平成31年定例会・臨時会</a></span></li>
      </ul>
    `;

    const pages = parseListPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]).toEqual({
      url: "https://www.town.assabu.lg.jp/site/gikai/list32-218.html",
      year: 2025,
    });
    expect(pages[1]).toEqual({
      url: "https://www.town.assabu.lg.jp/site/gikai/list32-205.html",
      year: 2024,
    });
    expect(pages[2]).toEqual({
      url: "https://www.town.assabu.lg.jp/site/gikai/list32-118.html",
      year: 2019,
    });
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/site/gikai/list32-205.html">令和6年定例会・臨時会</a>
      <a href="/site/gikai/list32-205.html">令和6年定例会・臨時会</a>
    `;

    const pages = parseListPage(html);

    expect(pages).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("年別ページから記事ページ URL を抽出する", () => {
    const html = `
      <ul>
        <li><span class="article_title"><a href="/site/gikai/9258.html">令和6年第4回議会定例会（12月10日）</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/9158.html">令和6年度決算審査特別委員会(9月10～11日)</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/9091.html">令和6年第1回議会定例会（3月5日～7日）</a></span></li>
      </ul>
    `;

    const urls = parseYearPage(html);

    expect(urls).toEqual([
      "https://www.town.assabu.lg.jp/site/gikai/9258.html",
      "https://www.town.assabu.lg.jp/site/gikai/9158.html",
      "https://www.town.assabu.lg.jp/site/gikai/9091.html",
    ]);
  });
});

describe("parseArticlePage", () => {
  it("記事ページから議事録本文 PDF を抽出する", () => {
    const html = `
      <h1>令和6年第3回議会定例会（9月10日～11日）</h1>
      <div class="detail_free">
        <h2>9月10日</h2>
        <p>・<a href="/uploaded/attachment/5268.pdf">名簿・議事日程 [PDFファイル／148KB]</a><br>
        ・<a href="/uploaded/attachment/5269.pdf">議事録本文 [PDFファイル／603KB]</a></p>
        <h2>9月11日</h2>
        <p>・<a href="/uploaded/attachment/5270.pdf">名簿・議事日程 [PDFファイル／119KB]</a><br>
        ・<a href="/uploaded/attachment/5271.pdf">議事録本文 [PDFファイル／70KB]</a></p>
      </div>
    `;

    const documents = parseArticlePage(
      html,
      "https://www.town.assabu.lg.jp/site/gikai/9157.html",
    );

    expect(documents).toHaveLength(2);
    expect(documents[0]).toEqual({
      title: "令和6年第3回議会定例会（9月10日～11日） 9月10日",
      heldOn: "2024-09-10",
      pdfUrl: "https://www.town.assabu.lg.jp/uploaded/attachment/5269.pdf",
      sourceUrl: "https://www.town.assabu.lg.jp/site/gikai/9157.html",
      meetingType: "plenary",
      pageId: "9157",
    });
    expect(documents[1]).toEqual({
      title: "令和6年第3回議会定例会（9月10日～11日） 9月11日",
      heldOn: "2024-09-11",
      pdfUrl: "https://www.town.assabu.lg.jp/uploaded/attachment/5271.pdf",
      sourceUrl: "https://www.town.assabu.lg.jp/site/gikai/9157.html",
      meetingType: "plenary",
      pageId: "9157",
    });
  });

  it("委員会ページを committee として扱う", () => {
    const html = `
      <h1>令和6年度決算審査特別委員会(9月10～11日)</h1>
      <div class="detail_free">
        <h2>9月10日</h2>
        <p>・<a href="/uploaded/attachment/5300.pdf">議事録本文 [PDFファイル／300KB]</a></p>
      </div>
    `;

    const documents = parseArticlePage(
      html,
      "https://www.town.assabu.lg.jp/site/gikai/9158.html",
    );

    expect(documents).toHaveLength(1);
    expect(documents[0]!.meetingType).toBe("committee");
    expect(documents[0]!.heldOn).toBe("2024-09-10");
  });
});
