import { describe, it, expect } from "vitest";
import {
  parseTopPage,
  parseIndexPage,
  parseDateText,
  parseYearlyPage,
  parseDetailPage,
  parseDateFromDetailPage,
} from "./list";

describe("parseTopPage", () => {
  it("年度別インデックスのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list69-560.html">令和8年</a></li>
        <li><a href="/site/gikai/list69-533.html">令和7年</a></li>
        <li><a href="/site/gikai/list69-478.html">令和6年</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和8年");
    expect(pages[0]!.url).toBe(
      "https://www.city.gero.lg.jp/site/gikai/list69-560.html",
    );
    expect(pages[1]!.label).toBe("令和7年");
    expect(pages[2]!.label).toBe("令和6年");
  });

  it("list69 以外のリンクは含まない", () => {
    const html = `
      <a href="/site/gikai/12345.html">お知らせ</a>
      <a href="/site/gikai/list69-533.html">令和7年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年");
  });
});

describe("parseIndexPage", () => {
  it("年度別会議録一覧ページへのリンクを抽出する", () => {
    const html = `
      <li>2025年8月25日更新<a href="/site/gikai/32094.html">令和7年下呂市議会会議録</a></li>
    `;

    const pages = parseIndexPage(html);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年下呂市議会会議録");
    expect(pages[0]!.url).toBe(
      "https://www.city.gero.lg.jp/site/gikai/32094.html",
    );
  });

  it("list69 系のリンクは除外する", () => {
    const html = `
      <a href="/site/gikai/list69-533.html">令和7年</a>
      <a href="/site/gikai/32094.html">令和7年下呂市議会会議録</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年下呂市議会会議録");
  });

  it("会議録を含まないリンクは除外する", () => {
    const html = `
      <a href="/site/gikai/12345.html">お知らせページ</a>
      <a href="/site/gikai/32094.html">令和7年下呂市議会会議録</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
  });
});

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("令和7年1月28日")).toBe("2025-01-28");
  });

  it("令和の日付を会議録テキストからパースする", () => {
    expect(
      parseDateText("会議録【令和7年2月25日　初日】"),
    ).toBe("2025-02-25");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("平成30年3月5日")).toBe("2018-03-05");
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("平成元年4月1日")).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("議案一覧")).toBeNull();
  });
});

describe("parseYearlyPage", () => {
  it("定例会・臨時会・委員会の各セクションから会議リンクを抽出する", () => {
    const html = `
      <h3>【定例会・臨時会】</h3>
      <ul>
        <li><a href="/site/gikai/31272.html">第1回　臨時会　令和7年1月28日</a></li>
        <li><a href="/site/gikai/31710.html">第2回　定例会　令和7年2月25日から3月24日</a></li>
      </ul>
      <h3>【常任委員会（付託案件審査）】</h3>
      <h4>民生教育まちづくり常任委員会</h4>
      <ul>
        <li><a href="/site/gikai/32360.html">第1回民生教育まちづくり常任委員会　令和7年3月12日</a></li>
      </ul>
    `;

    const entries = parseYearlyPage(html);

    expect(entries).toHaveLength(3);

    expect(entries[0]!.title).toBe("第1回　臨時会　令和7年1月28日");
    expect(entries[0]!.section).toBe("定例会・臨時会");
    expect(entries[0]!.detailUrl).toBe(
      "https://www.city.gero.lg.jp/site/gikai/31272.html",
    );

    expect(entries[1]!.title).toBe(
      "第2回　定例会　令和7年2月25日から3月24日",
    );
    expect(entries[1]!.section).toBe("定例会・臨時会");

    expect(entries[2]!.title).toBe(
      "第1回民生教育まちづくり常任委員会　令和7年3月12日",
    );
    expect(entries[2]!.section).toBe("民生教育まちづくり常任委員会");
  });

  it("list69 系のナビゲーションリンクは除外する", () => {
    const html = `
      <a href="/site/gikai/list69-533.html">令和7年</a>
      <h3>【定例会・臨時会】</h3>
      <a href="/site/gikai/31272.html">第1回　臨時会　令和7年1月28日</a>
    `;

    const entries = parseYearlyPage(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.title).toBe("第1回　臨時会　令和7年1月28日");
  });
});

describe("parseDetailPage", () => {
  it("会議録 PDF リンクを抽出し目次 PDF は除外する", () => {
    const html = `
      <a href="/uploaded/attachment/20085.pdf">下呂市定例会　令和7年3月　目次 [PDFファイル／56KB]</a>
      <a href="/uploaded/attachment/21538.pdf">会議録【令和7年2月25日　初日】 [PDFファイル／454KB]</a>
      <a href="/uploaded/attachment/21539.pdf">会議録【令和7年3月7日　一般質問】 [PDFファイル／600KB]</a>
      <a href="/uploaded/attachment/21540.pdf">会議録【令和7年3月11日　一般質問】 [PDFファイル／500KB]</a>
      <a href="/uploaded/attachment/21541.pdf">会議録【令和7年3月24日　最終日】 [PDFファイル／400KB]</a>
    `;

    const pdfs = parseDetailPage(html);

    expect(pdfs).toHaveLength(4);

    expect(pdfs[0]!.pdfUrl).toBe(
      "https://www.city.gero.lg.jp/uploaded/attachment/21538.pdf",
    );
    expect(pdfs[0]!.heldOn).toBe("2025-02-25");

    expect(pdfs[1]!.pdfUrl).toBe(
      "https://www.city.gero.lg.jp/uploaded/attachment/21539.pdf",
    );
    expect(pdfs[1]!.heldOn).toBe("2025-03-07");

    expect(pdfs[2]!.heldOn).toBe("2025-03-11");
    expect(pdfs[3]!.heldOn).toBe("2025-03-24");
  });

  it("議案 PDF は除外する", () => {
    const html = `
      <a href="/uploaded/attachment/20104.pdf">議員提出議案　発第5号 [PDFファイル／100KB]</a>
      <a href="/uploaded/attachment/21538.pdf">会議録【令和7年2月25日　初日】 [PDFファイル／454KB]</a>
    `;

    const pdfs = parseDetailPage(html);
    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.heldOn).toBe("2025-02-25");
  });

  it("委員会の会議録 PDF を抽出する", () => {
    const html = `
      <a href="/uploaded/attachment/21301.pdf">第1回民生教育まちづくり常任委員会資料 [PDFファイル／2.38MB]</a>
      <a href="/uploaded/attachment/21445.pdf">【会議録】令和7年3月12日第1回民生教育まちづくり常任委員会 [PDFファイル／426KB]</a>
    `;

    const pdfs = parseDetailPage(html);
    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.pdfUrl).toBe(
      "https://www.city.gero.lg.jp/uploaded/attachment/21445.pdf",
    );
    expect(pdfs[0]!.heldOn).toBe("2025-03-12");
  });

  it("日付のない PDF リンクは除外する", () => {
    const html = `
      <a href="/uploaded/attachment/12345.pdf">会議録まとめ [PDFファイル／100KB]</a>
    `;

    const pdfs = parseDetailPage(html);
    expect(pdfs).toHaveLength(0);
  });
});

describe("parseDateFromDetailPage", () => {
  it("日時テキストから日付を抽出する", () => {
    const html = `
      <p>日時　令和7年1月28日（火曜日）午前9時00分</p>
    `;

    expect(parseDateFromDetailPage(html)).toBe("2025-01-28");
  });

  it("日時テキストがない場合は null を返す", () => {
    const html = `<p>議案内容</p>`;
    expect(parseDateFromDetailPage(html)).toBeNull();
  });
});
