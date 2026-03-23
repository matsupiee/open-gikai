import { describe, it, expect } from "vitest";
import { parseListPage, parseDetailPage } from "./list";

describe("parseListPage", () => {
  it("gijiroku_*.html 形式のリンクを抽出する", () => {
    const html = `
      <div>
        <strong>令和7年</strong>
        <a href="/senkyo-gikai/gikai/gijiroku_r7_2.html">令和7年第1回定例会</a>
        <a href="/senkyo-gikai/gikai/gijiroku_r7_4.html">令和7年第2回臨時会</a>
        <hr>
        <strong>令和6年</strong>
        <a href="/senkyo-gikai/gikai/gijiroku_r6_5.html">令和6年第5回定例会</a>
      </div>
    `;

    const links = parseListPage(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.detailUrl).toBe(
      "https://www.city.buzen.lg.jp/senkyo-gikai/gikai/gijiroku_r7_2.html",
    );
    expect(links[0]!.title).toBe("令和7年第1回定例会");
    expect(links[1]!.title).toBe("令和7年第2回臨時会");
    expect(links[2]!.title).toBe("令和6年第5回定例会");
  });

  it("ハイフン区切り（古い年度）のリンクも抽出する", () => {
    const html = `
      <a href="/senkyo-gikai/gikai/gijiroku_h22-1.html">平成22年第1回定例会</a>
      <a href="/senkyo-gikai/gikai/gijiroku_h22-4.html">平成22年第4回定例会</a>
    `;

    const links = parseListPage(html);

    expect(links).toHaveLength(2);
    expect(links[0]!.detailUrl).toBe(
      "https://www.city.buzen.lg.jp/senkyo-gikai/gikai/gijiroku_h22-1.html",
    );
    expect(links[0]!.title).toBe("平成22年第1回定例会");
  });

  it("gijiroku 以外のリンクは無視する", () => {
    const html = `
      <a href="/other/page.html">他のページ</a>
      <a href="/senkyo-gikai/gikai/gijiroku_r7_2.html">令和7年第1回定例会</a>
      <a href="/senkyo-gikai/gikai/about.html">議会について</a>
    `;

    const links = parseListPage(html);
    expect(links).toHaveLength(1);
  });

  it("同じ URL の重複を除外する", () => {
    const html = `
      <a href="/senkyo-gikai/gikai/gijiroku_r7_2.html">令和7年第1回定例会</a>
      <a href="/senkyo-gikai/gikai/gijiroku_r7_2.html">令和7年第1回定例会</a>
    `;

    const links = parseListPage(html);
    expect(links).toHaveLength(1);
  });
});

describe("parseDetailPage", () => {
  const DETAIL_URL =
    "https://www.city.buzen.lg.jp/senkyo-gikai/gikai/gijiroku_r7_2.html";

  it("会議録 PDF リンクを抽出し、一般質問一覧表はスキップする", () => {
    const html = `
      <h1>令和7年第1回定例会</h1>
      <p><a href="/senkyo-gikai/gikai/documents/r7-2situmon_1.pdf">一般質問一覧表（PDF：126KB）</a></p>
      <p><a href="/senkyo-gikai/gikai/documents/r7-2kaigiroku.pdf">会議録（PDF：2,550KB）</a></p>
    `;

    const meetings = parseDetailPage(html, DETAIL_URL, "令和7年第1回定例会");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.buzen.lg.jp/senkyo-gikai/gikai/documents/r7-2kaigiroku.pdf",
    );
    expect(meetings[0]!.title).toBe("令和7年第1回定例会");
    expect(meetings[0]!.heldOn).toBe("2025-01-01");
  });

  it("古い年度の日付別 PDF リンクを正しく抽出する", () => {
    const html = `
      <h1>平成22年第1回定例会</h1>
      <p><a href="/senkyo-gikai/gikai/documents/22_3_2.pdf">3月2日会議録（PDF：350KB）</a></p>
      <p><a href="/senkyo-gikai/gikai/documents/22_3_9.pdf">3月9日会議録（PDF：782KB）</a></p>
      <p><a href="/senkyo-gikai/gikai/documents/22_3_19.pdf">3月19日会議録（PDF：228KB）</a></p>
    `;

    const meetings = parseDetailPage(
      html,
      "https://www.city.buzen.lg.jp/senkyo-gikai/gikai/gijiroku_h22-1.html",
      "平成22年第1回定例会",
    );

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.heldOn).toBe("2010-03-02");
    expect(meetings[0]!.title).toBe("平成22年第1回定例会 3月2日会議録");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.buzen.lg.jp/senkyo-gikai/gikai/documents/22_3_2.pdf",
    );

    expect(meetings[1]!.heldOn).toBe("2010-03-09");
    expect(meetings[2]!.heldOn).toBe("2010-03-19");
  });

  it("会議録を含まない PDF リンクはスキップする", () => {
    const html = `
      <h1>令和6年第3回定例会</h1>
      <p><a href="/senkyo-gikai/gikai/documents/r6-5situmon_1.pdf">一般質問一覧表（PDF：105KB）</a></p>
      <p><a href="/senkyo-gikai/gikai/documents/r6-5shiryou.pdf">資料（PDF：200KB）</a></p>
    `;

    const meetings = parseDetailPage(html, DETAIL_URL, "令和6年第3回定例会");
    expect(meetings).toHaveLength(0);
  });

  it("h1 がない場合は引数のタイトルを使う", () => {
    const html = `
      <div>
        <a href="/senkyo-gikai/gikai/documents/r7-2kaigiroku.pdf">会議録（PDF：2,550KB）</a>
      </div>
    `;

    const meetings = parseDetailPage(html, DETAIL_URL, "令和7年第1回定例会");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和7年第1回定例会");
  });
});
