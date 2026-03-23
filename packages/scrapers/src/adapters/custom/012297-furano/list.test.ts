import { describe, it, expect } from "vitest";
import { parseListPage, parseDetailPage, parseDateText } from "./list";

describe("parseListPage", () => {
  it("一覧ページから詳細ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li class="page"><a href="/shigikai/docs/1885853.html">令和8年 第1回定例会 会議録
        <span class="info">(<time datetime="2026-03-23">2026年3月23日</time>)</span></a></li>
        <li class="page"><a href="/shigikai/docs/1726682.html">令和7年 第4回定例会 会議録
        <span class="info">(<time datetime="2026-03-18">2026年3月18日</time>)</span></a></li>
        <li class="page"><a href="/shigikai/docs/1394461.html">令和7年第2回定例会 会議録
        <span class="info">(<time datetime="2026-02-25">2026年2月25日</time>)</span></a></li>
      </ul>
    `;

    const links = parseListPage(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.label).toBe("令和8年 第1回定例会 会議録 (2026年3月23日)");
    expect(links[0]!.url).toBe(
      "https://www.city.furano.hokkaido.jp/shigikai/docs/1885853.html"
    );
    expect(links[1]!.url).toBe(
      "https://www.city.furano.hokkaido.jp/shigikai/docs/1726682.html"
    );
  });

  it("class='page' でない li はスキップする", () => {
    const html = `
      <li><a href="/shigikai/docs/999.html">お知らせ</a></li>
      <li class="page"><a href="/shigikai/docs/1885853.html">令和8年 第1回定例会 会議録
        <span class="info">(<time datetime="2026-03-23">2026年3月23日</time>)</span></a></li>
    `;

    const links = parseListPage(html);
    expect(links).toHaveLength(1);
  });

  it("/shigikai/docs/ 以外のリンクはスキップする", () => {
    const html = `
      <li class="page"><a href="/other/page.html">その他のページ</a></li>
      <li class="page"><a href="/shigikai/docs/1394461.html">令和7年第2回定例会 会議録
        <span class="info">(<time datetime="2026-02-25">2026年2月25日</time>)</span></a></li>
    `;

    const links = parseListPage(html);
    expect(links).toHaveLength(1);
  });
});

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("第1号(令和7年6月10日)")).toBe("2025-06-10");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("第1号(平成20年3月5日)")).toBe("2008-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("目次")).toBeNull();
  });

  it("PDF サイズ情報付きのテキストからも抽出する", () => {
    expect(
      parseDateText(
        "令和7年第2回定例会 会議録 第1号(令和7年6月10日) (PDF 521KB)"
      )
    ).toBe("2025-06-10");
  });
});

describe("parseDetailPage", () => {
  it("会議録セクションの PDF リンクを抽出する", () => {
    const html = `
      <h1 class="page-title">令和7年第2回定例会 会議録</h1>
      <h2>令和7年第2回富良野市議会定例会(会期6月10日から6月20日)</h2>
      <h3>会議録</h3>
      <div class="ss-alignment">
        <p><a class="icon-pdf" href="/fs/7/0/8/7/5/_/__7__2_____________.pdf">令和7年第2回定例会 会議録 (目次) (PDF 260KB)</a></p>
        <p><a class="icon-pdf" href="/fs/7/0/8/7/6/_/__7__2__________1____7_6_10__.pdf">令和7年第2回定例会 会議録 第1号(令和7年6月10日) (PDF 521KB)</a></p>
        <p><a class="icon-pdf" href="/fs/7/0/8/7/7/_/__7__2__________2____7_6_17__.pdf">令和7年第2回定例会 会議録 第2号(令和7年6月17日) (PDF 1020KB)</a></p>
      </div>
      <h3>委員会からの調査報告書</h3>
      <p>案件はありません</p>
    `;

    const meetings = parseDetailPage(html);

    // 目次はスキップ（日付なし）
    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.heldOn).toBe("2025-06-10");
    expect(meetings[0]!.title).toBe("令和7年第2回定例会 会議録 第1号(令和7年6月10日)");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.furano.hokkaido.jp/fs/7/0/8/7/6/_/__7__2__________1____7_6_10__.pdf"
    );
    expect(meetings[0]!.sessionTitle).toBe("令和7年第2回富良野市議会定例会");

    expect(meetings[1]!.heldOn).toBe("2025-06-17");
  });

  it("臨時会の会議名を正しく抽出する", () => {
    const html = `
      <h2>令和7年第1回富良野市議会臨時会(会期4月15日から4月15日)</h2>
      <h3>会議録</h3>
      <p><a class="icon-pdf" href="/fs/1/2/3/4/5/_/test.pdf">令和7年第1回臨時会 会議録 第1号(令和7年4月15日) (PDF 300KB)</a></p>
      <h3>可決された意見書</h3>
    `;

    const meetings = parseDetailPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.sessionTitle).toBe("令和7年第1回富良野市議会臨時会");
  });

  it("会議録セクション外の PDF はスキップする", () => {
    const html = `
      <h2>令和7年第4回富良野市議会定例会(会期12月1日から12月10日)</h2>
      <h3>会議録</h3>
      <p><a class="icon-pdf" href="/fs/1/2/3/4/5/_/gijiroku1.pdf">第1号(令和7年12月1日) (PDF 500KB)</a></p>
      <h3>可決された意見書</h3>
      <p><a class="icon-pdf" href="/fs/9/9/9/9/9/_/ikensho.pdf">意見書(令和7年12月10日) (PDF 100KB)</a></p>
    `;

    const meetings = parseDetailPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-12-01");
  });

  it("h2 に定例会・臨時会がない場合は空文字のセッションタイトル", () => {
    const html = `
      <h2>令和7年 富良野市議会会議録</h2>
      <h3>会議録</h3>
      <p><a class="icon-pdf" href="/fs/1/2/3/4/5/_/test.pdf">第1号(令和7年3月1日) (PDF 200KB)</a></p>
      <h3>その他</h3>
    `;

    const meetings = parseDetailPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.sessionTitle).toBe("");
  });
});
