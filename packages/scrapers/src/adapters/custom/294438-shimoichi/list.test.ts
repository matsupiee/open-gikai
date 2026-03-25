import { describe, expect, it } from "vitest";
import { parseCategoryPage } from "./list";

describe("parseCategoryPage", () => {
  it("年別カテゴリページから会議概要ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/0001672.html">令和6年第6回定例会（12月）</a></li>
        <li><a href="/0001605.html">令和6年第5回定例会（9月）</a></li>
        <li><a href="/0001548.html">令和6年第4回定例会（6月）</a></li>
      </ul>
    `;

    const refs = parseCategoryPage(html);

    expect(refs).toHaveLength(3);
    expect(refs[0]!.pageUrl).toBe("https://www.town.shimoichi.lg.jp/0001672.html");
    expect(refs[0]!.numericId).toBe("0001672");
    expect(refs[1]!.pageUrl).toBe("https://www.town.shimoichi.lg.jp/0001605.html");
    expect(refs[1]!.numericId).toBe("0001605");
    expect(refs[2]!.numericId).toBe("0001548");
  });

  it("重複するリンクは一度だけ返す", () => {
    const html = `
      <a href="/0001672.html">令和6年第6回定例会</a>
      <a href="/0001672.html">令和6年第6回定例会（12月）</a>
    `;

    const refs = parseCategoryPage(html);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.numericId).toBe("0001672");
  });

  it("数字IDのないリンクはスキップする", () => {
    const html = `
      <a href="/category/1-3-10-0-0-0-0-0-0-0.html">令和6年一覧</a>
      <a href="/soshiki/1-1-0-0-0_14.html">議会事務局</a>
      <a href="/0001672.html">令和6年第6回定例会</a>
    `;

    const refs = parseCategoryPage(html);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.numericId).toBe("0001672");
  });

  it("会議ページが存在しない場合は空配列を返す", () => {
    const html = `
      <div>
        <a href="/category/1-3-10-0-0-0-0-0-0-0.html">一覧</a>
      </div>
    `;

    const refs = parseCategoryPage(html);
    expect(refs).toHaveLength(0);
  });
});
