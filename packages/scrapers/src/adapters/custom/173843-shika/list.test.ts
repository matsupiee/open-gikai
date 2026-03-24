import { describe, it, expect } from "vitest";
import {
  parseIndexPage,
  parseDateFromText,
  parseYearPage,
  extractTitle,
} from "./list";

describe("parseIndexPage", () => {
  it("年度別ページへのリンクを抽出する（令和期）", () => {
    const html = `
      <ul>
        <li><span class="article_title"><a href="/site/gikai/1080.html">令和7年 議会会議録</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/1079.html">令和6年 議会会議録</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/1078.html">令和5年 議会会議録</a></span></li>
      </ul>
    `;

    const pages = parseIndexPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.year).toBe(2025);
    expect(pages[0]!.url).toBe("https://www.town.shika.lg.jp/site/gikai/1080.html");
    expect(pages[1]!.year).toBe(2024);
    expect(pages[1]!.url).toBe("https://www.town.shika.lg.jp/site/gikai/1079.html");
    expect(pages[2]!.year).toBe(2023);
    expect(pages[2]!.url).toBe("https://www.town.shika.lg.jp/site/gikai/1078.html");
  });

  it("年度別ページへのリンクを抽出する（平成期）", () => {
    const html = `
      <ul>
        <li><span class="article_title"><a href="/site/gikai/1060.html">平成30年 議会会議録</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/1074.html">平成31年・令和元年 議会会議録</a></span></li>
      </ul>
    `;

    const pages = parseIndexPage(html);

    // 平成31年・令和元年は令和元年（2019）として処理される
    const h30 = pages.find((p) => p.year === 2018);
    expect(h30).toBeDefined();
    expect(h30!.url).toBe("https://www.town.shika.lg.jp/site/gikai/1060.html");

    const r1 = pages.find((p) => p.year === 2019);
    expect(r1).toBeDefined();
    expect(r1!.url).toBe("https://www.town.shika.lg.jp/site/gikai/1074.html");
  });

  it("令和元年を正しく2019年に変換する", () => {
    const html = `
      <li><span class="article_title"><a href="/site/gikai/1074.html">平成31年・令和元年 議会会議録</a></span></li>
    `;

    const pages = parseIndexPage(html);
    expect(pages.find((p) => p.year === 2019)).toBeDefined();
  });

  it("議会会議録を含まないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><span class="article_title"><a href="/site/gikai/1079.html">令和6年 議会会議録</a></span></li>
        <li><a href="/site/other/123.html">その他のページ</a></li>
        <li><a href="/site/gikai/list23-19.html">一覧ページ</a></li>
      </ul>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.year).toBe(2024);
  });
});

describe("parseDateFromText", () => {
  it("「令和6年　3月12日（1日目） [PDFファイル／568KB]」を正しく変換する", () => {
    expect(parseDateFromText("令和6年　3月12日（1日目） [PDFファイル／568KB]", 2024)).toBe("2024-03-12");
  });

  it("「令和6年　6月　4日（1日目）」（全角スペース含む）を正しく変換する", () => {
    expect(parseDateFromText("令和6年　6月　4日（1日目）", 2024)).toBe("2024-06-04");
  });

  it("「令和6年3月12日」を正しく変換する", () => {
    expect(parseDateFromText("令和6年3月12日", 2024)).toBe("2024-03-12");
  });

  it("「03月12日（1日目）」を正しく変換する（年度ページ短縮形式）", () => {
    expect(parseDateFromText("03月12日（1日目）", 2024)).toBe("2024-03-12");
  });

  it("「令和元年3月12日」を正しく変換する", () => {
    expect(parseDateFromText("令和元年3月12日", 2019)).toBe("2019-03-12");
  });

  it("1桁の月日も正しくゼロパディングする", () => {
    expect(parseDateFromText("令和6年8月5日", 2024)).toBe("2024-08-05");
  });

  it("日付情報がない場合は null を返す", () => {
    expect(parseDateFromText("令和6年 議会会議録", 2024)).toBeNull();
  });
});

describe("extractTitle", () => {
  it("ファイルサイズ情報を除去する", () => {
    expect(extractTitle("令和6年　3月12日（1日目） [PDFファイル／568KB]")).toBe(
      "令和6年3月12日（1日目）"
    );
  });

  it("全角スペースを除去する", () => {
    expect(extractTitle("令和6年　6月　4日（1日目）")).toBe(
      "令和6年6月4日（1日目）"
    );
  });
});

describe("parseYearPage", () => {
  it("PDF リンクをセクション情報と共に正しく抽出する（令和6年形式）", () => {
    const html = `
      <table>
        <tr>
          <th rowspan="3" scope="rowgroup">第1回定例会</th>
          <td><a href="/uploaded/attachment/1417.pdf">令和6年　3月12日（1日目） [PDFファイル／568KB]</a></td>
        </tr>
        <tr>
          <td><a href="/uploaded/attachment/1418.pdf">令和6年　3月19日（2日目） [PDFファイル／737KB]</a></td>
        </tr>
        <tr>
          <td><a href="/uploaded/attachment/1419.pdf">令和6年　3月26日（3日目） [PDFファイル／654KB]</a></td>
        </tr>
        <tr>
          <th rowspan="3" scope="rowgroup">第3回定例会</th>
          <td><a href="/uploaded/attachment/1423.pdf">令和6年　8月27日（1日目） [PDFファイル／496KB]</a></td>
        </tr>
        <tr>
          <td><a href="/uploaded/attachment/1424.pdf">令和6年　9月　3日（2日目） [PDFファイル／1.43MB]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(5);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shika.lg.jp/uploaded/attachment/1417.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2024-03-12");
    expect(meetings[0]!.session).toBe("第1回定例会");
    expect(meetings[0]!.title).toBe("令和6年3月12日（1日目）");

    expect(meetings[3]!.pdfUrl).toBe(
      "https://www.town.shika.lg.jp/uploaded/attachment/1423.pdf"
    );
    expect(meetings[3]!.heldOn).toBe("2024-08-27");
    expect(meetings[3]!.session).toBe("第3回定例会");
  });

  it("臨時会のセクションを正しく取得する", () => {
    const html = `
      <table>
        <tr>
          <th rowspan="1" scope="rowgroup">第1回臨時会</th>
          <td><a href="/uploaded/attachment/1430.pdf">令和6年　2月　1日 [PDFファイル／300KB]</a></td>
        </tr>
      </table>
    `;
    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.session).toBe("第1回臨時会");
    expect(meetings[0]!.heldOn).toBe("2024-02-01");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div class="content"><p>会議録はありません</p></div>`;
    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("リンクテキストが空の場合はスキップする", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/uploaded/attachment/1417.pdf"></a></td>
          <td><a href="/uploaded/attachment/1418.pdf">令和6年　3月19日（2日目）</a></td>
        </tr>
      </table>
    `;
    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-19");
  });

  it("uploaded/attachment を含まないリンクはスキップする", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/uploaded/attachment/1417.pdf">令和6年　3月12日（1日目）</a></td>
          <td><a href="/site/other/page.html">その他ページ</a></td>
        </tr>
      </table>
    `;
    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
  });
});
