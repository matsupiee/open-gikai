import { describe, it, expect } from "vitest";
import { parseIndexPage, parseYearlyPage } from "./list";

describe("parseIndexPage", () => {
  it("サイドバーの年別ページリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <nav>
          <ul>
            <li class="iconPage"><a href="/city-council/minutes/page005826.html">令和7年</a></li>
            <li class="iconPage"><a href="/city-council/minutes/page005353.html">令和6年</a></li>
            <li class="iconPage"><a href="/city-council/minutes/page004451.html">令和5年</a></li>
          </ul>
        </nav>
      </body>
      </html>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.url).toBe(
      "https://www.city.nasukarasuyama.lg.jp/city-council/minutes/page005826.html"
    );
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.url).toBe(
      "https://www.city.nasukarasuyama.lg.jp/city-council/minutes/page005353.html"
    );
    expect(result[1]!.year).toBe(2024);
    expect(result[2]!.year).toBe(2023);
  });

  it("令和元年を正しく 2019 に変換する", () => {
    const html = `
      <li><a href="/city-council/minutes/page000278.html">令和元年</a></li>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2019);
  });

  it("平成年を正しく変換する", () => {
    const html = `
      <li><a href="/city-council/minutes/page000282.html">平成30年</a></li>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2018);
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <li><a href="/city-council/minutes/page005353.html">令和6年</a></li>
      <li><a href="/city-council/minutes/page005353.html">令和6年（再掲）</a></li>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
  });

  it("年が取得できないリンクはスキップする", () => {
    const html = `
      <li><a href="/city-council/minutes/pageXXXXXX.html">会議録</a></li>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(0);
  });

  it("minutes/page パターン以外のリンクは無視する", () => {
    const html = `
      <li><a href="/city-council/index.html">令和6年</a></li>
      <li><a href="/city-council/minutes/page005353.html">令和6年</a></li>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
  });
});

describe("parseYearlyPage", () => {
  it("h2 セクション内の PDF リンクを抽出する", () => {
    const html = `
      <article id="contents">
        <h2>第5回12月定例会</h2>
        <ul>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/1771461228_doc_40_0.pdf" target="_blank">第5回12月定例会 目次</a> [PDF形式／67.86KB]</li>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/1771461232_doc_40_0.pdf" target="_blank">第5回12月定例会 第1日（11月28日）</a> [PDF形式／430.38KB]</li>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/1771461235_doc_40_0.pdf" target="_blank">第5回12月定例会 第2日（12月3日）</a> [PDF形式／510.12KB]</li>
        </ul>
      </article>
    `;

    const result = parseYearlyPage(html, 2025);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.nasukarasuyama.lg.jp/data/doc/1771461232_doc_40_0.pdf"
    );
    expect(result[0]!.title).toBe("第5回12月定例会 第1日（11月28日）");
    expect(result[0]!.heldOn).toBe("2025-11-28");
    expect(result[1]!.heldOn).toBe("2025-12-03");
  });

  it("「目次」PDF はスキップする", () => {
    const html = `
      <article id="contents">
        <h2>第3回6月定例会</h2>
        <ul>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/111_doc_1_0.pdf">第3回6月定例会 目次</a></li>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/222_doc_2_0.pdf">第3回6月定例会 第1日（6月10日）</a></li>
        </ul>
      </article>
    `;

    const result = parseYearlyPage(html, 2024);
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-06-10");
  });

  it("臨時会の PDF も抽出する", () => {
    const html = `
      <article id="contents">
        <h2>第1回3月2日臨時会</h2>
        <ul>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/999_doc_5_0.pdf">第1回3月2日臨時会 目次</a></li>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/888_doc_6_0.pdf">第1回3月2日臨時会 第1日（3月2日）</a></li>
        </ul>
      </article>
    `;

    const result = parseYearlyPage(html, 2024);
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-03-02");
    expect(result[0]!.pdfId).toBe("888_doc_6_0");
  });

  it("開催日（月日）が解析できないリンクはスキップする", () => {
    const html = `
      <article id="contents">
        <h2>第5回12月定例会</h2>
        <ul>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/123_doc_1_0.pdf">第5回12月定例会 全日程</a></li>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/456_doc_2_0.pdf">第5回12月定例会 第1日（11月28日）</a></li>
        </ul>
      </article>
    `;

    const result = parseYearlyPage(html, 2025);
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2025-11-28");
  });

  it("複数の h2 セクションを処理する", () => {
    const html = `
      <article id="contents">
        <h2>第4回9月定例会</h2>
        <ul>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/aaa_doc_1_0.pdf">第4回9月定例会 第1日（9月5日）</a></li>
        </ul>
        <h2>第3回6月定例会</h2>
        <ul>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/bbb_doc_2_0.pdf">第3回6月定例会 第1日（6月10日）</a></li>
        </ul>
      </article>
    `;

    const result = parseYearlyPage(html, 2024);
    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2024-09-05");
    expect(result[1]!.heldOn).toBe("2024-06-10");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseYearlyPage("", 2024)).toEqual([]);
  });

  it("pdfId は PDF ファイル名から抽出される", () => {
    const html = `
      <article id="contents">
        <h2>第5回12月定例会</h2>
        <ul>
          <li><a href="https://www.city.nasukarasuyama.lg.jp/data/doc/1771461232_doc_40_0.pdf">第5回12月定例会 第1日（11月28日）</a></li>
        </ul>
      </article>
    `;

    const result = parseYearlyPage(html, 2025);
    expect(result[0]!.pdfId).toBe("1771461232_doc_40_0");
  });
});
