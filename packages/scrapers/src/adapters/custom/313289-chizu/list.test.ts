import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, extractDayLabel } from "./list";
import { extractDateFromLabel } from "./shared";

describe("extractDateFromLabel", () => {
  it("令和の日付を抽出する", () => {
    expect(extractDateFromLabel("初　日（R6.12.05）")).toBe("2024-12-05");
  });

  it("平成の日付を抽出する", () => {
    expect(extractDateFromLabel("初日（H27.03.10）")).toBe("2015-03-10");
  });

  it("半角括弧でも抽出できる", () => {
    expect(extractDateFromLabel("初日(R6.12.05)")).toBe("2024-12-05");
  });

  it("日付が見つからない場合は null を返す", () => {
    expect(extractDateFromLabel("会議録")).toBeNull();
  });
});

describe("extractDayLabel", () => {
  it("初日を抽出する", () => {
    expect(extractDayLabel("初　日（R6.12.05）")).toBe("初日");
  });

  it("2日目を抽出する", () => {
    expect(extractDayLabel("２日目（R6.12.06）　一般質問")).toBe("2日目");
  });

  it("最終日を抽出する", () => {
    expect(extractDayLabel("最終日（R6.12.12）")).toBe("最終日");
  });

  it("1日限りを抽出する", () => {
    expect(extractDayLabel("１日限り（R6.06.14）")).toBe("1日限り");
  });

  it("半角数字の日目を抽出する", () => {
    expect(extractDayLabel("3日目（R6.09.10）")).toBe("3日目");
  });
});

const TOP_PAGE_HTML = `
<div>
  <ul>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/u149/">令和８年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/g620/">令和７年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/s166/">令和６年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/g761-copy-2/">令和５年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/g761/">令和４年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/7-copy-2/">令和３年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/7/">令和２年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/6/">平成31年・令和元年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/5/">平成30年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/4/">平成29年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/3/">平成28年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/1/">平成27年</a></li>
    <li><a href="/chizu/gikaijimukyoku/gijiroku/2/">平成26年</a></li>
  </ul>
</div>
`;

describe("parseTopPage", () => {
  it("令和8年の年度ページ URL を抽出する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    const r8 = result.find((p) => p.year === 2026);
    expect(r8).not.toBeUndefined();
    expect(r8!.url).toBe(
      "https://www1.town.chizu.tottori.jp/chizu/gikaijimukyoku/gijiroku/u149/",
    );
  });

  it("令和6年の年度ページ URL を抽出する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    const r6 = result.find((p) => p.year === 2024);
    expect(r6).not.toBeUndefined();
    expect(r6!.url).toBe(
      "https://www1.town.chizu.tottori.jp/chizu/gikaijimukyoku/gijiroku/s166/",
    );
  });

  it("令和元年を正しく西暦2019に変換する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    // 平成31年・令和元年度 → 「令和元年」「平成31年」の両方にマッチし得るが、令和元年 = 2019
    const r1 = result.find((p) => p.year === 2019);
    expect(r1).not.toBeUndefined();
  });

  it("平成26年を正しく西暦2014に変換する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    const h26 = result.find((p) => p.year === 2014);
    expect(h26).not.toBeUndefined();
    expect(h26!.url).toBe(
      "https://www1.town.chizu.tottori.jp/chizu/gikaijimukyoku/gijiroku/2/",
    );
  });

  it("全リンクを抽出する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    expect(result.length).toBeGreaterThanOrEqual(13);
  });
});

const YEAR_PAGE_HTML = `
<h3>第4回定例会</h3>
<p>
  <a href="/user/filer_public/29/51/2951832d-9e7e-4dc4-a5ce-2da2977a53a5/zhi-tou-ting-ling-he-6nian-di-4hui-ding-li-hui-1.pdf">
    初　日（R6.12.05）
  </a>
</p>
<p>
  <a href="/user/filer_public/ab/cd/abcd1234-5678-9012-3456-789012345678/day2.pdf">
    ２日目（R6.12.06）　一般質問
  </a>
</p>
<p>
  <a href="/user/filer_public/ef/12/ef123456-7890-1234-5678-901234567890/final.pdf">
    最終日（R6.12.12）
  </a>
</p>
<h3>第2回臨時会</h3>
<p>
  <a href="/user/filer_public/34/56/34567890-1234-5678-9012-345678901234/rinji.pdf">
    １日限り（R6.06.14）
  </a>
</p>
<h3>第1回定例会</h3>
<p>
  <a href="/user/filer_public/78/90/78901234-5678-9012-3456-789012345678/march1.pdf">
    初　日（R6.03.05）
  </a>
</p>
`;

describe("parseYearPage", () => {
  it("定例会の複数日分を抽出する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    const session4 = result.filter((m) => m.title.startsWith("第4回定例会"));
    expect(session4.length).toBe(3);

    expect(session4[0]!.heldOn).toBe("2024-12-05");
    expect(session4[0]!.title).toBe("第4回定例会 初日");
    expect(session4[0]!.meetingType).toBe("plenary");

    expect(session4[1]!.heldOn).toBe("2024-12-06");
    expect(session4[1]!.title).toBe("第4回定例会 2日目");

    expect(session4[2]!.heldOn).toBe("2024-12-12");
    expect(session4[2]!.title).toBe("第4回定例会 最終日");
  });

  it("臨時会を抽出する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    const rinji = result.find((m) => m.meetingType === "extraordinary");
    expect(rinji).not.toBeUndefined();
    expect(rinji!.heldOn).toBe("2024-06-14");
    expect(rinji!.title).toBe("第2回臨時会 1日限り");
  });

  it("全件を抽出する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    expect(result.length).toBe(5);
  });

  it("PDF URL が絶対 URL になる", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    for (const m of result) {
      expect(m.pdfUrl).toMatch(/^https:\/\//);
    }
  });
});

const PHOTOLIB_YEAR_PAGE_HTML = `
<h3>第4回定例会</h3>
<p>
  <a href="/photolib/chizu_gikai/12805.pdf">
    初　日（H28.12.05）
  </a>
</p>
<p>
  <a href="/photolib/chizu_gikai/12806.pdf">
    最終日（H28.12.15）
  </a>
</p>
`;

describe("parseYearPage with photolib URLs", () => {
  it("photolib 形式の PDF を抽出する", () => {
    const result = parseYearPage(PHOTOLIB_YEAR_PAGE_HTML);
    expect(result.length).toBe(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www1.town.chizu.tottori.jp/photolib/chizu_gikai/12805.pdf",
    );
    expect(result[0]!.heldOn).toBe("2016-12-05");
  });
});
