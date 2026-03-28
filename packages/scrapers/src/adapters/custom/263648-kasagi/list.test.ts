import { describe, expect, it } from "vitest";
import { parseDetailPage, parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("年度ページリンクを抽出して西暦に変換する", () => {
    const html = `
      <li><a href="/soshiki_view.php?so_cd1=2&amp;bn_cd=5&amp;p_bn_cd=46">令和6年</a></li>
      <li><a href="/soshiki_view.php?so_cd1=2&amp;bn_cd=5&amp;p_bn_cd=49">令和7年</a></li>
      <li><a href="/soshiki_view.php?so_cd1=2&amp;bn_cd=5&amp;p_bn_cd=31">平成31年</a></li>
    `;

    const results = parseTopPage(html);

    expect(results).toHaveLength(3);
    expect(results[0]!.year).toBe(2024);
    expect(results[1]!.url).toBe(
      "https://www.town.kasagi.lg.jp/soshiki_view.php?so_cd1=2&bn_cd=5&p_bn_cd=49",
    );
    expect(results[2]!.year).toBe(2019);
  });

  it("重複リンクは除外する", () => {
    const html = `
      <a href="/soshiki_view.php?bn_cd=5&amp;p_bn_cd=49">令和7年</a>
      <a href="/soshiki_view.php?bn_cd=5&amp;p_bn_cd=49">令和7年</a>
    `;

    expect(parseTopPage(html)).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("年度ページから会議詳細リンクを抽出する", () => {
    const html = `
      <div id="kakuka_right">
        <h2>令和7年</h2>
        <ul>
          <li><a href="contents_detail.php?co=kak&amp;frmId=2002">令和7年9月第3回定例会</a><span class="date"> [2026年2月24日]</span></li>
          <li><a href="contents_detail.php?co=kak&amp;frmId=2001">令和7年6月第2回定例会</a><span class="date"> [2026年2月24日]</span></li>
        </ul>
      </div>
    `;

    const results = parseYearPage(html);

    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("令和7年9月第3回定例会");
    expect(results[0]!.detailPageUrl).toBe(
      "https://www.town.kasagi.lg.jp/contents_detail.php?co=kak&frmId=2002",
    );
  });

  it("定例会・臨時会以外のリンクは除外する", () => {
    const html = `
      <div id="kakuka_right">
        <ul>
          <li><a href="contents_detail.php?co=kak&amp;frmId=2008">令和7年11月 定期監査結果の公表</a></li>
          <li><a href="contents_detail.php?co=kak&amp;frmId=2001">令和7年6月第2回定例会</a></li>
        </ul>
      </div>
    `;

    const results = parseYearPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toContain("定例会");
  });
});

describe("parseDetailPage", () => {
  it("詳細ページから複数 PDF 添付を抽出する", () => {
    const html = `
      <h1>令和7年9月第3回定例会</h1>
      <div class="mol_attachfileblock">
        <ul>
          <li><a href="./cmsfiles/contents/0000002/2002/0911.pdf"><img src="images/pdf.gif" /> 1日目(ファイル名：0911.pdf サイズ：781.40KB)</a></li>
          <li><a href="./cmsfiles/contents/0000002/2002/0925.pdf"><img src="images/pdf.gif" />2日目(ファイル名：0925.pdf サイズ：644.40KB)</a></li>
          <li><a href="./cmsfiles/contents/0000002/2002/0926.pdf"><img src="images/pdf.gif" /> 3日目(ファイル名：0926.pdf サイズ：568.27KB)</a></li>
        </ul>
      </div>
    `;

    const results = parseDetailPage(
      html,
      "https://www.town.kasagi.lg.jp/contents_detail.php?co=kak&frmId=2002",
      "fallback",
    );

    expect(results).toHaveLength(3);
    expect(results[0]!.title).toBe("令和7年9月第3回定例会");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.kasagi.lg.jp/cmsfiles/contents/0000002/2002/0911.pdf",
    );
    expect(results[0]!.linkLabel).toBe("1日目");
    expect(results[2]!.linkLabel).toBe("3日目");
  });

  it("h1 がない場合は fallback title を使う", () => {
    const html = `
      <div class="mol_attachfileblock">
        <ul>
          <li><a href="./cmsfiles/contents/0000001/1741/0215.pdf">1日目</a></li>
        </ul>
      </div>
    `;

    const results = parseDetailPage(
      html,
      "https://www.town.kasagi.lg.jp/contents_detail.php?co=kak&frmId=1741",
      "令和6年2月第1回定例会",
    );

    expect(results[0]!.title).toBe("令和6年2月第1回定例会");
  });
});
