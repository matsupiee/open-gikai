import { describe, expect, it } from "vitest";
import {
  parseCommitteePage,
  parseDateText,
  parseIndexPage,
  parsePlenaryPage,
} from "./list";

describe("parseIndexPage", () => {
  it("本会議録インデックスから年度別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/15030.html">令和7年本会議録</a>2026年2月19日更新</li>
        <li><a href="/site/gikai/13734.html">令和6年本会議録</a>2025年2月26日更新</li>
        <li><a href="/site/gikai/11162.html">令和5年本会議録</a>2024年2月27日更新</li>
      </ul>
    `;

    const pages = parseIndexPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年本会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.heguri.nara.jp/site/gikai/15030.html"
    );
    expect(pages[1]!.label).toBe("令和6年本会議録");
    expect(pages[2]!.label).toBe("令和5年本会議録");
  });

  it("委員会インデックスから委員会ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/1895.html">文教厚生委員会</a>2026年3月6日更新</li>
        <li><a href="/site/gikai/1894.html">予算審査特別委員会</a>2025年11月10日更新</li>
      </ul>
    `;

    const pages = parseIndexPage(html);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.label).toBe("文教厚生委員会");
    expect(pages[0]!.url).toBe(
      "https://www.town.heguri.nara.jp/site/gikai/1895.html"
    );
    expect(pages[1]!.label).toBe("予算審査特別委員会");
  });

  it("/site/gikai/ パターンに合致しないリンクはスキップする", () => {
    const html = `
      <a href="/uploaded/attachment/12345.pdf">PDFファイル</a>
      <a href="/site/gikai/15030.html">令和7年本会議録</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年本会議録");
  });
});

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(
      parseDateText("第1日目（令和7年3月4日）[PDFファイル／984KB]")
    ).toBe("2025-03-04");
  });

  it("平成の日付をパースする", () => {
    expect(
      parseDateText("平成31年3月8日[PDFファイル／364KB]")
    ).toBe("2019-03-08");
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年6月5日[PDFファイル／438KB]")).toBe(
      "2019-06-05"
    );
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("平成元年4月1日")).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("資料一覧")).toBeNull();
  });
});

describe("parsePlenaryPage", () => {
  it("定例会と臨時会の見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <h2>令和7年　第1回1月臨時会会議録</h2>
      <ul>
        <li><a href="/uploaded/attachment/10506.pdf">第1日目（令和7年1月20日）[PDFファイル／391KB]</a></li>
      </ul>
      <h2>令和7年　第2回3月定例会会議録</h2>
      <ul>
        <li><a href="/uploaded/attachment/11193.pdf">第1日目（令和7年3月4日）[PDFファイル／984KB]</a></li>
        <li><a href="/uploaded/attachment/11194.pdf">第2日目（令和7年3月5日）[PDFファイル／886KB]</a></li>
      </ul>
    `;

    const meetings = parsePlenaryPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.section).toBe("第1回1月臨時会");
    expect(meetings[0]!.title).toBe("第1回1月臨時会 第1日目");
    expect(meetings[0]!.heldOn).toBe("2025-01-20");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.heguri.nara.jp/uploaded/attachment/10506.pdf"
    );

    expect(meetings[1]!.section).toBe("第2回3月定例会");
    expect(meetings[1]!.title).toBe("第2回3月定例会 第1日目");
    expect(meetings[1]!.heldOn).toBe("2025-03-04");

    expect(meetings[2]!.section).toBe("第2回3月定例会");
    expect(meetings[2]!.title).toBe("第2回3月定例会 第2日目");
    expect(meetings[2]!.heldOn).toBe("2025-03-05");
  });

  it("日付のないリンクはスキップする", () => {
    const html = `
      <h2>令和7年　第2回3月定例会会議録</h2>
      <ul>
        <li><a href="/uploaded/attachment/11193.pdf">第1日目（令和7年3月4日）[PDFファイル／984KB]</a></li>
        <li><a href="/uploaded/attachment/99999.pdf">会議資料一覧</a></li>
      </ul>
    `;

    const meetings = parsePlenaryPage(html);
    expect(meetings).toHaveLength(1);
  });
});

describe("parseCommitteePage", () => {
  it("通常の委員会ページから PDF リンクを抽出する", () => {
    const html = `
      <h2>令和7年12月</h2>
      <ul>
        <li><a href="/uploaded/attachment/12508.pdf">令和7年12月4日 [PDFファイル／559KB]</a></li>
      </ul>
      <h2>令和5年12月</h2>
      <ul>
        <li><a href="/uploaded/attachment/8885.pdf">令和5年12月6日 [PDFファイル／275KB]</a></li>
      </ul>
    `;

    const meetings = parseCommitteePage(html, "文教厚生委員会");

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("文教厚生委員会");
    expect(meetings[0]!.heldOn).toBe("2025-12-04");
    expect(meetings[0]!.section).toBe("文教厚生委員会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.heguri.nara.jp/uploaded/attachment/12508.pdf"
    );

    expect(meetings[1]!.heldOn).toBe("2023-12-06");
  });

  it("予算審査特別委員会の2ファイル構成を正しく抽出する", () => {
    const html = `
      <h2>令和7年3月　予算審査特別委員会</h2>
      <ul>
        <li><a href="/uploaded/attachment/11811.pdf">一般会計（令和7年3月7日） [PDFファイル／1.38MB]</a></li>
        <li><a href="/uploaded/attachment/11812.pdf">各特別会計・各事業会計（令和7年3月10日） [PDFファイル／487KB]</a></li>
      </ul>
    `;

    const meetings = parseCommitteePage(html, "予算審査特別委員会");

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("予算審査特別委員会 一般会計");
    expect(meetings[0]!.heldOn).toBe("2025-03-07");

    expect(meetings[1]!.title).toBe(
      "予算審査特別委員会 各特別会計・各事業会計"
    );
    expect(meetings[1]!.heldOn).toBe("2025-03-10");
  });

  it("令和元年の日付も正しく変換する", () => {
    const html = `
      <h2>令和元年12月</h2>
      <ul>
        <li><a href="/uploaded/attachment/2856.pdf">令和元年12月4日[PDFファイル／551KB]</a></li>
      </ul>
    `;

    const meetings = parseCommitteePage(html, "文教厚生委員会");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-12-04");
  });
});
