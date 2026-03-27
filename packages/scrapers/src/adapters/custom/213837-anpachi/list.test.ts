import { describe, expect, it } from "vitest";
import { parseDetailPage, parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("トップページから会議録の年度別ページを抽出する", () => {
    const html = `
      <article class="cate_post01">
        <h2><a href="./../category/9-3-0-0-0-0-0-0-0-0.html">会議録</a></h2>
        <ul class="category01">
          <li><a href="./../category/9-3-10-0-0-0-0-0-0-0.html">令和7年</a></li>
          <li><a href="./../category/9-3-9-0-0-0-0-0-0-0.html">令和6年</a></li>
          <li><a href="./../category/9-3-3-0-0-0-0-0-0-0.html">令和元年</a></li>
        </ul>
      </article>
    `;

    const result = parseTopPage(
      html,
      "https://www.town.anpachi.lg.jp/category/9-0-0-0-0-0-0-0-0-0.html",
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      label: "令和7年",
      url: "https://www.town.anpachi.lg.jp/category/9-3-10-0-0-0-0-0-0-0.html",
    });
    expect(result[2]?.label).toBe("令和元年");
  });

  it("重複した年度リンクは1件にまとめる", () => {
    const html = `
      <a href="./../category/9-3-10-0-0-0-0-0-0-0.html">令和7年</a>
      <a href="./../category/9-3-10-0-0-0-0-0-0-0.html">令和7年</a>
    `;

    const result = parseTopPage(
      html,
      "https://www.town.anpachi.lg.jp/category/9-0-0-0-0-0-0-0-0-0.html",
    );

    expect(result).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("年度ページから会議録記事を抽出する", () => {
    const html = `
      <ul class="category_end">
        <li><a href="https://www.town.anpachi.lg.jp/0000002474.html">令和7年第4回安八町議会定例会会議録</a><span class="date">[2026年2月4日]</span></li>
        <li><a href="https://www.town.anpachi.lg.jp/0000002429.html">令和7年第2回安八町議会臨時会会議録</a><span class="date">[2025年12月9日]</span></li>
      </ul>
    `;

    const result = parseYearPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      detailUrl: "https://www.town.anpachi.lg.jp/0000002474.html",
      title: "令和7年第4回安八町議会定例会会議録",
      pageId: "0000002474",
    });
    expect(result[1]?.pageId).toBe("0000002429");
  });
});

describe("parseDetailPage", () => {
  it("記事ページから会議録 PDF を抽出する", () => {
    const html = `
      <h1>令和7年第4回安八町議会定例会会議録</h1>
      <div class="mol_attachfileblock block_index_2">
        <p class="mol_attachfileblock_title">会議録</p>
        <ul>
          <li><a href="./cmsfiles/contents/0000002/2474/202512.pdf"><img src="images/pdf.gif" alt="">令和7年第4回議会定例会</a></li>
        </ul>
      </div>
    `;

    const result = parseDetailPage(
      html,
      "https://www.town.anpachi.lg.jp/0000002474.html",
    );

    expect(result).toEqual({
      pdfUrl: "https://www.town.anpachi.lg.jp/cmsfiles/contents/0000002/2474/202512.pdf",
      articleTitle: "令和7年第4回安八町議会定例会会議録",
    });
  });

  it("会議録ブロックがない場合は null を返す", () => {
    const html = `
      <h1>令和7年第4回安八町議会定例会会議録</h1>
      <div class="mol_attachfileblock">
        <p class="mol_attachfileblock_title">一般質問通告</p>
      </div>
    `;

    expect(
      parseDetailPage(
        html,
        "https://www.town.anpachi.lg.jp/0000002474.html",
      ),
    ).toBeNull();
  });
});
