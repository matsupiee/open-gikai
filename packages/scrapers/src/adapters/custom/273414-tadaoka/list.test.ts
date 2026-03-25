import { describe, expect, it } from "vitest";
import { filterByYear, parseDetailPage, parseListPage } from "./list";

describe("parseListPage", () => {
  it("詳細ページリンク（主パターン）を抽出する", () => {
    const html = `
      <a href="/soshiki/gikai_jimukyoku/1/5709.html">令和7年第1回定例会会議録</a>
      <a href="/soshiki/gikai_jimukyoku/1/5581.html">令和6年第4回定例会会議録</a>
    `;
    const entries = parseListPage(html);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.detailUrl).toBe(
      "https://www.town.tadaoka.osaka.jp/soshiki/gikai_jimukyoku/1/5709.html"
    );
    expect(entries[0]!.title).toBe("令和7年第1回定例会会議録");
    expect(entries[0]!.directPdfUrl).toBeNull();
    expect(entries[1]!.detailUrl).toBe(
      "https://www.town.tadaoka.osaka.jp/soshiki/gikai_jimukyoku/1/5581.html"
    );
  });

  it("詳細ページリンク（別パス）を抽出する", () => {
    const html = `
      <a href="/gyousei/gikai/kessanshinsatokubetu/3456.html">決算審査特別委員会会議録</a>
    `;
    const entries = parseListPage(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.detailUrl).toBe(
      "https://www.town.tadaoka.osaka.jp/gyousei/gikai/kessanshinsatokubetu/3456.html"
    );
    expect(entries[0]!.directPdfUrl).toBeNull();
  });

  it("直接 PDF リンクを抽出する", () => {
    const html = `
      <a href="/material/files/group/21/32302640.pdf">令和2年第2回臨時会会議録</a>
    `;
    const entries = parseListPage(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.directPdfUrl).toBe(
      "https://www.town.tadaoka.osaka.jp/material/files/group/21/32302640.pdf"
    );
    expect(entries[0]!.detailUrl).toBeNull();
    expect(entries[0]!.title).toBe("令和2年第2回臨時会会議録");
  });

  it("プロトコル相対 URL の直接 PDF リンクを正しく変換する", () => {
    const html = `
      <a href="//www.town.tadaoka.osaka.jp/material/files/group/21/31641478.pdf">令和2年第3回臨時会会議録</a>
    `;
    const entries = parseListPage(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.directPdfUrl).toBe(
      "https://www.town.tadaoka.osaka.jp/material/files/group/21/31641478.pdf"
    );
  });

  it("関係ない URL はスキップする", () => {
    const html = `
      <a href="/gyousei/gikai/index.html">議会トップ</a>
      <a href="https://example.com/other.pdf">外部 PDF</a>
      <a href="/soshiki/gikai_jimukyoku/1/5709.html">令和7年第1回定例会会議録</a>
    `;
    const entries = parseListPage(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.title).toBe("令和7年第1回定例会会議録");
  });

  it("混在（詳細ページ + 直接 PDF）を正しく抽出する", () => {
    const html = `
      <a href="/soshiki/gikai_jimukyoku/1/5709.html">令和7年第1回定例会会議録</a>
      <a href="/material/files/group/21/32302640.pdf">令和2年第2回臨時会会議録</a>
    `;
    const entries = parseListPage(html);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.detailUrl).not.toBeNull();
    expect(entries[0]!.directPdfUrl).toBeNull();
    expect(entries[1]!.detailUrl).toBeNull();
    expect(entries[1]!.directPdfUrl).not.toBeNull();
  });
});

describe("parseDetailPage", () => {
  it("詳細ページから PDF リンクとセクションを抽出する", () => {
    const html = `
      <h1>令和7年第1回定例会 会議録</h1>
      <h3>本会議 会議録</h3>
      <ul>
        <li><a href="/material/files/group/21/20250217teirei1_1.pdf">令和7年2月17日（月曜日）（PDF：1,016KB）</a></li>
        <li><a href="/material/files/group/21/20250218teirei1_2.pdf">令和7年2月18日（火曜日）（PDF：900KB）</a></li>
      </ul>
      <h3>委員会 会議録</h3>
      <ul>
        <li><a href="/material/files/group/21/20250225soumu1.pdf">令和7年2月25日（月曜日）（PDF：504KB）</a></li>
      </ul>
    `;

    const meetings = parseDetailPage(html, "令和7年第1回定例会会議録");

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.tadaoka.osaka.jp/material/files/group/21/20250217teirei1_1.pdf"
    );
    expect(meetings[0]!.title).toBe("令和7年第1回定例会 会議録 本会議 会議録");
    expect(meetings[0]!.heldOn).toBe("2025-02-17");
    expect(meetings[0]!.section).toBe("本会議 会議録");

    expect(meetings[1]!.heldOn).toBe("2025-02-18");

    expect(meetings[2]!.pdfUrl).toBe(
      "https://www.town.tadaoka.osaka.jp/material/files/group/21/20250225soumu1.pdf"
    );
    expect(meetings[2]!.title).toBe("令和7年第1回定例会 会議録 委員会 会議録");
    expect(meetings[2]!.heldOn).toBe("2025-02-25");
    expect(meetings[2]!.section).toBe("委員会 会議録");
  });

  it("h1 がない場合は listTitle をタイトルとして使用する", () => {
    const html = `
      <h3>本会議 会議録</h3>
      <ul>
        <li><a href="/material/files/group/21/20250217teirei1_1.pdf">令和7年2月17日</a></li>
      </ul>
    `;
    const meetings = parseDetailPage(html, "令和7年第1回定例会会議録");
    expect(meetings[0]!.title).toBe("令和7年第1回定例会会議録 本会議 会議録");
  });

  it("/material/files/group/21/ 以外の PDF はスキップする", () => {
    const html = `
      <h1>会議録</h1>
      <h3>本会議</h3>
      <a href="/material/files/group/99/other.pdf">別グループの PDF</a>
      <a href="/material/files/group/21/20250217.pdf">令和7年2月17日</a>
    `;
    const meetings = parseDetailPage(html, "会議録");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("/group/21/");
  });

  it("プロトコル相対 URL の PDF を正しく変換する", () => {
    const html = `
      <h1>会議録</h1>
      <h3>本会議</h3>
      <a href="//www.town.tadaoka.osaka.jp/material/files/group/21/20250217.pdf">令和7年2月17日</a>
    `;
    const meetings = parseDetailPage(html, "会議録");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.tadaoka.osaka.jp/material/files/group/21/20250217.pdf"
    );
  });

  it("日付テキストが古い形式（ハッシュ PDF）の場合 heldOn は null", () => {
    const html = `
      <h1>平成27年第1回定例会 会議録</h1>
      <h3>本会議 会議録</h3>
      <a href="/material/files/group/21/1e1b89d5f5fdea63f6c5041e4a7e4ae8.pdf">会議録</a>
    `;
    const meetings = parseDetailPage(html, "平成27年第1回定例会 会議録");
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("空の HTML は空配列を返す", () => {
    const meetings = parseDetailPage("", "");
    expect(meetings).toHaveLength(0);
  });
});

describe("filterByYear", () => {
  const entries = [
    {
      title: "令和7年第1回定例会会議録",
      detailUrl: "https://example.com/1.html",
      directPdfUrl: null,
    },
    {
      title: "令和6年第4回定例会会議録",
      detailUrl: "https://example.com/2.html",
      directPdfUrl: null,
    },
    {
      title: "令和6年第3回定例会会議録",
      detailUrl: "https://example.com/3.html",
      directPdfUrl: null,
    },
    {
      title: "平成27年第1回定例会会議録",
      detailUrl: "https://example.com/4.html",
      directPdfUrl: null,
    },
    {
      title: "令和2年第2回臨時会会議録",
      detailUrl: null,
      directPdfUrl: "https://example.com/5.pdf",
    },
  ];

  it("令和7年（2025年）でフィルタリングする", () => {
    const filtered = filterByYear(entries, 2025);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("令和7年第1回定例会会議録");
  });

  it("令和6年（2024年）でフィルタリングする", () => {
    const filtered = filterByYear(entries, 2024);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.title).toBe("令和6年第4回定例会会議録");
    expect(filtered[1]!.title).toBe("令和6年第3回定例会会議録");
  });

  it("平成27年（2015年）でフィルタリングする", () => {
    const filtered = filterByYear(entries, 2015);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("平成27年第1回定例会会議録");
  });

  it("令和2年（2020年）でフィルタリングする（直接 PDF リンクを含む）", () => {
    const filtered = filterByYear(entries, 2020);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("令和2年第2回臨時会会議録");
  });

  it("該当なしの場合は空配列を返す", () => {
    const filtered = filterByYear(entries, 2000);
    expect(filtered).toHaveLength(0);
  });
});
