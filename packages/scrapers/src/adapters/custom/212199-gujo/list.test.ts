import { describe, expect, it } from "vitest";
import { extractHeldOn, parseIndexPage, parseYearPage } from "./list";

describe("parseIndexPage", () => {
  it("対象年度の年度ページ URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/admin/detail/12114.html">令和7年郡上市議会会議録</a></li>
        <li><a href="/admin/detail/11664.html">令和6年郡上市議会会議録</a></li>
      </ul>
    `;

    expect(parseIndexPage(html, 2024)).toEqual([
      "https://www.city.gujo.gifu.jp/admin/detail/11664.html",
    ]);
  });

  it("2019 年は平成31年と令和元年の 2 ページを返す", () => {
    const html = `
      <ul>
        <li><a href="/admin/detail/7792.html">令和元年郡上市議会会議録</a></li>
        <li><a href="/admin/detail/7589.html">平成31年郡上市議会会議録</a></li>
      </ul>
    `;

    expect(parseIndexPage(html, 2019)).toEqual([
      "https://www.city.gujo.gifu.jp/admin/detail/7792.html",
      "https://www.city.gujo.gifu.jp/admin/detail/7589.html",
    ]);
  });

  it("平成16年〜20年は共通ページを返す", () => {
    const html = `
      <ul>
        <li><a href="/admin/detail/9405.html">平成16年～平成20年郡上市議会会議録</a></li>
      </ul>
    `;

    expect(parseIndexPage(html, 2006)).toEqual([
      "https://www.city.gujo.gifu.jp/admin/detail/9405.html",
    ]);
  });
});

describe("extractHeldOn", () => {
  it("会期タイトルと日別リンクから開催日を生成する", () => {
    expect(
      extractHeldOn("令和6年第1回郡上市議会定例会", "第１日目 ２月２０日"),
    ).toBe("2024-02-20");
  });

  it("令和元年に対応する", () => {
    expect(
      extractHeldOn("令和元年第1回郡上市議会定例会", "第1日目 6月10日"),
    ).toBe("2019-06-10");
  });
});

describe("parseYearPage", () => {
  it("年度ページから会議録 PDF を抽出する", () => {
    const html = `
      <div class="post">
        <p>令和６年第1回郡上市議会定例会</p>
        <p><a href="/admin/docs/aaa.pdf">第１日目 ２月２０日</a>（pdf・784 KB）</p>
        <p><a href="/admin/docs/bbb.pdf">第２日目 ２月２２日</a>（pdf・188 KB）</p>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和6年第1回郡上市議会定例会 第1日目 2月20日");
    expect(meetings[0]!.pdfUrl).toBe("https://www.city.gujo.gifu.jp/admin/docs/aaa.pdf");
    expect(meetings[0]!.heldOn).toBe("2024-02-20");
    expect(meetings[0]!.meetingType).toBe("plenary");
  });

  it("議員別採択・採決結果 PDF は除外する", () => {
    const html = `
      <div class="post">
        <p>令和６年第2回郡上市議会臨時会</p>
        <p><a href="/admin/docs/meeting.pdf">第１日目 ４月１６日</a>（pdf・570KB）</p>
        <p><a href="/admin/docs/vote.pdf">議員別採択結果一覧表（令和６年第2回臨時会）</a>（pdf・1.06MB）</p>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("平成31年ページも正しく解析する", () => {
    const html = `
      <div class="post">
        <p>平成31年第2回郡上市議会定例会</p>
        <p><a href="/admin/docs/ccc.pdf">第1日目 2月26日</a>(pdf・1.1MB)</p>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-02-26");
  });

  it("会議タイトルがない PDF 段落は無視する", () => {
    const html = `<div class="post"><p><a href="/admin/docs/aaa.pdf">第1日目 2月20日</a></p></div>`;
    expect(parseYearPage(html)).toEqual([]);
  });
});
