import { describe, it, expect } from "vitest";
import {
  parseTopPageAllLinks,
  parseYearListPage,
  parseDetailPage,
} from "./list";

// 議会トップページのサンプル HTML
const TOP_PAGE_HTML = `
<html>
<body>
<div class="menu-list">
  <ul>
    <li><a href="/site/gikai/list47-407.html">令和8年度 定例会</a></li>
    <li><a href="/site/gikai/list47-357.html">令和7年度 定例会</a></li>
    <li><a href="/site/gikai/list47-341.html">令和6年度 定例会</a></li>
    <li><a href="/site/gikai/list47-312.html">令和5年度 定例会</a></li>
    <li><a href="/site/gikai/list47-98.html">令和4年度 定例会</a></li>
    <li><a href="/site/gikai/list48-358.html">令和7年度 臨時会</a></li>
    <li><a href="/site/gikai/list48-340.html">令和6年度 臨時会</a></li>
    <li><a href="/site/gikai/list48-316.html">令和5年度 臨時会</a></li>
  </ul>
</div>
</body>
</html>
`;

describe("parseTopPageAllLinks", () => {
  it("定例会リンクを抽出する", () => {
    const result = parseTopPageAllLinks(TOP_PAGE_HTML);
    const plenary = result.filter((r) => r.meetingType === "plenary");
    expect(plenary.length).toBe(5);
  });

  it("臨時会リンクを抽出する", () => {
    const result = parseTopPageAllLinks(TOP_PAGE_HTML);
    const extraordinary = result.filter((r) => r.meetingType === "extraordinary");
    expect(extraordinary.length).toBe(3);
  });

  it("令和7年の定例会 URL を抽出する", () => {
    const result = parseTopPageAllLinks(TOP_PAGE_HTML);
    const r7plenary = result.find(
      (r) => r.year === 2025 && r.meetingType === "plenary"
    );
    expect(r7plenary).not.toBeUndefined();
    expect(r7plenary!.url).toBe(
      "https://www.town.yuasa.wakayama.jp/site/gikai/list47-357.html"
    );
  });

  it("令和7年の臨時会 URL を抽出する", () => {
    const result = parseTopPageAllLinks(TOP_PAGE_HTML);
    const r7extraordinary = result.find(
      (r) => r.year === 2025 && r.meetingType === "extraordinary"
    );
    expect(r7extraordinary).not.toBeUndefined();
    expect(r7extraordinary!.url).toBe(
      "https://www.town.yuasa.wakayama.jp/site/gikai/list48-358.html"
    );
  });

  it("令和6年の定例会 URL を抽出する", () => {
    const result = parseTopPageAllLinks(TOP_PAGE_HTML);
    const r6 = result.find(
      (r) => r.year === 2024 && r.meetingType === "plenary"
    );
    expect(r6).not.toBeUndefined();
    expect(r6!.url).toBe(
      "https://www.town.yuasa.wakayama.jp/site/gikai/list47-341.html"
    );
  });

  it("令和4年度の定例会 URL を抽出する（令和4年 = 2022）", () => {
    const result = parseTopPageAllLinks(TOP_PAGE_HTML);
    const r4 = result.find(
      (r) => r.year === 2022 && r.meetingType === "plenary"
    );
    expect(r4).not.toBeUndefined();
    expect(r4!.url).toBe(
      "https://www.town.yuasa.wakayama.jp/site/gikai/list47-98.html"
    );
  });

  it("全リンクを抽出する", () => {
    const result = parseTopPageAllLinks(TOP_PAGE_HTML);
    expect(result.length).toBe(8);
  });

  it("重複する URL は1件だけ返す", () => {
    const html = `
      <a href="/site/gikai/list47-357.html">令和7年度 定例会</a>
      <a href="/site/gikai/list47-357.html">令和7年度 定例会（重複）</a>
    `;
    const result = parseTopPageAllLinks(html);
    expect(result.length).toBe(1);
  });
});

// 年度別一覧ページのサンプル HTML
const YEAR_LIST_PAGE_HTML = `
<html>
<body>
<div class="section">
  <ul>
    <li><a href="/site/gikai/10474.html">第4回定例会（令和7年12月）</a></li>
    <li><a href="/site/gikai/9925.html">第3回定例会（令和7年9月）</a></li>
    <li><a href="/site/gikai/10022.html">第2回定例会（令和7年6月）</a></li>
    <li><a href="/site/gikai/9475.html">第1回定例会（令和7年3月）</a></li>
  </ul>
</div>
</body>
</html>
`;

describe("parseYearListPage", () => {
  it("会議詳細ページへのリンクを抽出する", () => {
    const result = parseYearListPage(YEAR_LIST_PAGE_HTML);
    expect(result.length).toBe(4);
  });

  it("第4回定例会のリンクを抽出する", () => {
    const result = parseYearListPage(YEAR_LIST_PAGE_HTML);
    const fourth = result.find((r) => r.title.includes("第4回"));
    expect(fourth).not.toBeUndefined();
    expect(fourth!.url).toBe(
      "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html"
    );
    expect(fourth!.title).toBe("第4回定例会（令和7年12月）");
  });

  it("第1回定例会のリンクを抽出する", () => {
    const result = parseYearListPage(YEAR_LIST_PAGE_HTML);
    const first = result.find((r) => r.title.includes("第1回"));
    expect(first).not.toBeUndefined();
    expect(first!.url).toBe(
      "https://www.town.yuasa.wakayama.jp/site/gikai/9475.html"
    );
  });

  it("list47/list48 形式のリンクは除外する", () => {
    const html = `
      <a href="/site/gikai/list47-357.html">令和7年度</a>
      <a href="/site/gikai/10474.html">第4回定例会</a>
    `;
    const result = parseYearListPage(html);
    expect(result.length).toBe(1);
    expect(result[0]!.url).toBe(
      "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html"
    );
  });

  it("重複する URL は1件だけ返す", () => {
    const html = `
      <a href="/site/gikai/10474.html">第4回定例会</a>
      <a href="/site/gikai/10474.html">第4回定例会（重複）</a>
    `;
    const result = parseYearListPage(html);
    expect(result.length).toBe(1);
  });
});

// 会議詳細ページのサンプル HTML
const DETAIL_PAGE_HTML = `
<html>
<body>
<div class="content">
  <h2>令和7年12月定例会（第4回）</h2>
  <ul>
    <li>
      <a href="/uploaded/attachment/9920.pdf">会期日程表（131KB）</a>
    </li>
    <li>
      <a href="/uploaded/attachment/9923.pdf">一般質問（115KB）</a>
    </li>
    <li>
      <a href="/uploaded/attachment/9922.pdf">議決結果（146KB）</a>
    </li>
  </ul>
</div>
</body>
</html>
`;

describe("parseDetailPage", () => {
  it("全 PDF リンクを抽出する", () => {
    const result = parseDetailPage(
      DETAIL_PAGE_HTML,
      "令和7年12月定例会（第4回）",
      "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html",
      "plenary"
    );
    expect(result.length).toBe(3);
  });

  it("PDF URL が正しく変換される", () => {
    const result = parseDetailPage(
      DETAIL_PAGE_HTML,
      "令和7年12月定例会（第4回）",
      "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html",
      "plenary"
    );
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.yuasa.wakayama.jp/uploaded/attachment/9920.pdf"
    );
    expect(result[1]!.pdfUrl).toBe(
      "https://www.town.yuasa.wakayama.jp/uploaded/attachment/9923.pdf"
    );
    expect(result[2]!.pdfUrl).toBe(
      "https://www.town.yuasa.wakayama.jp/uploaded/attachment/9922.pdf"
    );
  });

  it("タイトルが全 PDF に引き継がれる", () => {
    const result = parseDetailPage(
      DETAIL_PAGE_HTML,
      "令和7年12月定例会（第4回）",
      "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html",
      "plenary"
    );
    for (const m of result) {
      expect(m.title).toBe("令和7年12月定例会（第4回）");
    }
  });

  it("meetingType が正しく設定される（定例会）", () => {
    const result = parseDetailPage(
      DETAIL_PAGE_HTML,
      "令和7年12月定例会（第4回）",
      "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html",
      "plenary"
    );
    for (const m of result) {
      expect(m.meetingType).toBe("plenary");
    }
  });

  it("meetingType が正しく設定される（臨時会タイトル）", () => {
    const html = `
      <a href="/uploaded/attachment/9001.pdf">議事録</a>
    `;
    const result = parseDetailPage(
      html,
      "令和7年臨時会",
      "https://www.town.yuasa.wakayama.jp/site/gikai/9001.html",
      "plenary"
    );
    expect(result.length).toBe(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("detailPageUrl が設定される", () => {
    const result = parseDetailPage(
      DETAIL_PAGE_HTML,
      "令和7年12月定例会（第4回）",
      "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html",
      "plenary"
    );
    for (const m of result) {
      expect(m.detailPageUrl).toBe(
        "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html"
      );
    }
  });

  it("PDF がない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません</p></div>`;
    const result = parseDetailPage(
      html,
      "タイトル",
      "https://www.town.yuasa.wakayama.jp/site/gikai/9999.html",
      "plenary"
    );
    expect(result.length).toBe(0);
  });

  it("重複する PDF URL は1件だけ返す", () => {
    const html = `
      <a href="/uploaded/attachment/9920.pdf">会期日程表</a>
      <a href="/uploaded/attachment/9920.pdf">会期日程表（重複）</a>
    `;
    const result = parseDetailPage(
      html,
      "令和7年12月定例会",
      "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html",
      "plenary"
    );
    expect(result.length).toBe(1);
  });

  it("heldOn はタイトルに日付がない場合 null を返す", () => {
    const result = parseDetailPage(
      DETAIL_PAGE_HTML,
      "令和7年12月定例会（第4回）",
      "https://www.town.yuasa.wakayama.jp/site/gikai/10474.html",
      "plenary"
    );
    // "令和7年12月定例会（第4回）" は日まで含まないため null
    expect(result[0]!.heldOn).toBeNull();
  });
});
