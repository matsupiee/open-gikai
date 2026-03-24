import { describe, it, expect } from "vitest";
import { parseListPage, cleanTitle } from "./list";

describe("cleanTitle", () => {
  it("ファイルサイズ表記を除去する", () => {
    expect(cleanTitle("令和8年第1回臨時会 (261KB)")).toBe("令和8年第1回臨時会");
  });

  it("カンマ付きサイズ表記を除去する", () => {
    expect(cleanTitle("第4回定例会 (1,470KB)")).toBe("第4回定例会");
  });

  it("サイズ表記がない場合はそのまま返す", () => {
    expect(cleanTitle("第3回定例会")).toBe("第3回定例会");
  });

  it("前後の空白をトリムする", () => {
    expect(cleanTitle("  第2回定例会 (500KB)  ")).toBe("第2回定例会");
  });
});

describe("parseListPage", () => {
  it("年度別に PDF リンクを抽出する", () => {
    const html = `
      <h3>令和８年</h3>
      <ul>
        <li><a href="/resource.php?e=abc123">令和8年第1回臨時会 (261KB)</a></li>
      </ul>
      <h3>令和７年</h3>
      <ul>
        <li><a href="/resource.php?e=def456">第4回定例会 (1,470KB)</a></li>
        <li><a href="/resource.php?e=ghi789">第3回定例会 (1,200KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.title).toBe("令和8年第1回臨時会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kumamoto-oguni.lg.jp/resource.php?e=abc123"
    );
    expect(meetings[0]!.year).toBe(2026);

    expect(meetings[1]!.title).toBe("第4回定例会");
    expect(meetings[1]!.year).toBe(2025);

    expect(meetings[2]!.title).toBe("第3回定例会");
    expect(meetings[2]!.year).toBe(2025);
  });

  it("year 引数でフィルタリングする", () => {
    const html = `
      <h3>令和８年</h3>
      <ul>
        <li><a href="/resource.php?e=abc123">令和8年第1回臨時会 (261KB)</a></li>
      </ul>
      <h3>令和７年</h3>
      <ul>
        <li><a href="/resource.php?e=def456">第4回定例会 (1,470KB)</a></li>
      </ul>
    `;

    const meetings2025 = parseListPage(html, 2025);

    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.year).toBe(2025);
    expect(meetings2025[0]!.title).toBe("第4回定例会");
  });

  it("令和元年を正しく処理する", () => {
    const html = `
      <h3>令和元年</h3>
      <ul>
        <li><a href="/resource.php?e=xyz000">第3回定例会 (900KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2019);
  });

  it("平成年号を正しく処理する", () => {
    const html = `
      <h3>平成27年</h3>
      <ul>
        <li><a href="/resource.php?e=hei001">第1回定例会 (800KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2015);
  });

  it("h3 タグが年度情報でない場合はスキップする", () => {
    const html = `
      <h3>議会会議録</h3>
      <h3>令和８年</h3>
      <ul>
        <li><a href="/resource.php?e=abc123">令和8年第1回臨時会 (261KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2026);
  });

  it("resource.php 以外のリンクは無視する", () => {
    const html = `
      <h3>令和８年</h3>
      <ul>
        <li><a href="/ogunitowngikai/other-page">その他のページ</a></li>
        <li><a href="/resource.php?e=abc123">令和8年第1回臨時会 (261KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("resource.php?e=abc123");
  });

  it("会議録が存在しない年は空配列を返す", () => {
    const html = `
      <h3>令和８年</h3>
      <ul>
        <li><a href="/resource.php?e=abc123">令和8年第1回臨時会 (261KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2020);

    expect(meetings).toHaveLength(0);
  });

  it("複数の会議種別を正しく抽出する", () => {
    const html = `
      <h3>令和６年</h3>
      <ul>
        <li><a href="/resource.php?e=r6_01">第1回定例会 (1,000KB)</a></li>
        <li><a href="/resource.php?e=r6_02">第1回臨時会 (300KB)</a></li>
        <li><a href="/resource.php?e=r6_03">総務文教福祉常任委員会 (400KB)</a></li>
        <li><a href="/resource.php?e=r6_04">第1回全員協議会 (200KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(4);
    expect(meetings[0]!.title).toBe("第1回定例会");
    expect(meetings[1]!.title).toBe("第1回臨時会");
    expect(meetings[2]!.title).toBe("総務文教福祉常任委員会");
    expect(meetings[3]!.title).toBe("第1回全員協議会");
  });
});
