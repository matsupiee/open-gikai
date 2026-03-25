import { describe, it, expect } from "vitest";
import { parseYearPage, parseYearLinks } from "./list";
import { parseDateFromText, extractYearFromTitle } from "./shared";

describe("parseYearPage", () => {
  it("h3 + ul + p（会期）から会議録エントリを抽出する（実際の HTML 構造）", () => {
    const html = `
      <h3>令和6年第4回定例会</h3>
      <ul class="list-base">
        <li><a href="/gikai/kaigi/pdf/r06-4t.pdf" target="_blank"><span>会議録(PDF:3.2 MB)</span></a></li>
      </ul>
      <p>会期:2024年12月02日(月曜日)～2024年12月12日(木曜日)</p>
    `;
    const pageUrl = "https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2024.html";

    const results = parseYearPage(html, pageUrl);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("令和6年第4回定例会");
    expect(results[0]!.pdfUrl).toBe("https://www.town.yoshioka.lg.jp/gikai/kaigi/pdf/r06-4t.pdf");
    expect(results[0]!.heldOn).toBe("2024-12-02");
    expect(results[0]!.sourceUrl).toBe("https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2024.html");
  });

  it("複数の会議録エントリを抽出する", () => {
    const html = `
      <h3>令和6年第4回定例会</h3>
      <ul class="list-base">
        <li><a href="/gikai/kaigi/pdf/r06-4t.pdf" target="_blank"><span>会議録(PDF:3.2 MB)</span></a></li>
      </ul>
      <p>会期:2024年12月02日(月曜日)～2024年12月12日(木曜日)</p>
      <h3>令和6年第3回定例会</h3>
      <ul class="list-base">
        <li><a href="/gikai/kaigi/pdf/r06-3t.pdf" target="_blank"><span>会議録(PDF:2.9 MB)</span></a></li>
      </ul>
      <p>会期:2024年09月02日(月曜日)～2024年09月13日(金曜日)</p>
    `;
    const pageUrl = "https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2024.html";

    const results = parseYearPage(html, pageUrl);

    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("令和6年第4回定例会");
    expect(results[1]!.title).toBe("令和6年第3回定例会");
    expect(results[1]!.heldOn).toBe("2024-09-02");
  });

  it("PDF リンクがないセクションはスキップする", () => {
    const html = `
      <h3>令和6年第4回定例会</h3>
      <p>会期:2024年12月02日</p>
      <h3>令和6年第3回定例会</h3>
      <ul class="list-base">
        <li><a href="/gikai/kaigi/pdf/r06-3t.pdf">会議録(PDF:2.0 MB)</a></li>
      </ul>
      <p>会期:2024年09月02日</p>
    `;
    const pageUrl = "https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2024.html";

    const results = parseYearPage(html, pageUrl);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("令和6年第3回定例会");
  });

  it("h3 がない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const pageUrl = "https://www.town.yoshioka.lg.jp/gikai/kaigiroku/";

    const results = parseYearPage(html, pageUrl);

    expect(results).toHaveLength(0);
  });

  it("docs ディレクトリの PDF URL も処理する", () => {
    const html = `
      <h3>令和7年第3回定例会</h3>
      <ul class="list-base">
        <li><a href="/gikai/kaigi/docs/%E4%BB%A4%E5%92%8C%EF%BC%97%E5%B9%B4%E7%AC%AC%EF%BC%93%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">会議録(PDF:1.5 MB)</a></li>
      </ul>
      <p>会期:2025年09月01日(月曜日)</p>
    `;
    const pageUrl = "https://www.town.yoshioka.lg.jp/gikai/kaigiroku/";

    const results = parseYearPage(html, pageUrl);

    expect(results).toHaveLength(1);
    expect(results[0]!.pdfUrl).toContain("https://www.town.yoshioka.lg.jp/gikai/kaigi/docs/");
  });

  it("臨時会エントリも抽出する", () => {
    const html = `
      <h3>令和6年第1回臨時会</h3>
      <ul class="list-base">
        <li><a href="/gikai/kaigi/pdf/r06-1ri.pdf">会議録(PDF:350 KB)</a></li>
      </ul>
      <p>会期:2024年01月15日(月曜日)</p>
    `;
    const pageUrl = "https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2024.html";

    const results = parseYearPage(html, pageUrl);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("令和6年第1回臨時会");
  });
});

describe("parseYearLinks", () => {
  it("bn_{year}.html リンクを収集する", () => {
    const html = `
      <ul>
        <li><a href="/gikai/kaigiroku/bn_2024.html">令和6年（2024年）</a></li>
        <li><a href="/gikai/kaigiroku/bn_2023.html">令和5年（2023年）</a></li>
        <li><a href="/gikai/kaigiroku/bn_2009.html">平成21年（2009年）</a></li>
      </ul>
    `;

    const result = parseYearLinks(html);

    expect(result.size).toBe(3);
    expect(result.get(2024)).toBe("https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2024.html");
    expect(result.get(2023)).toBe("https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2023.html");
    expect(result.get(2009)).toBe("https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2009.html");
  });

  it("過去年リンクがない場合は空マップを返す", () => {
    const html = `<html><body><p>会議録一覧</p></body></html>`;

    const result = parseYearLinks(html);

    expect(result.size).toBe(0);
  });

  it("絶対 URL のリンクも処理する", () => {
    const html = `
      <a href="https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2022.html">令和4年</a>
    `;

    const result = parseYearLinks(html);

    expect(result.get(2022)).toBe("https://www.town.yoshioka.lg.jp/gikai/kaigiroku/bn_2022.html");
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和6年第4回定例会")).toBe(2024);
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearFromTitle("令和元年第1回定例会")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromTitle("平成21年第4回定例会")).toBe(2009);
  });

  it("全角数字を正しく変換する", () => {
    expect(extractYearFromTitle("令和６年第４回定例会")).toBe(2024);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});

describe("parseDateFromText", () => {
  it("西暦日付を正しく変換する", () => {
    expect(parseDateFromText("2024年12月02日(月曜日)〜12月12日(木曜日)")).toBe("2024-12-02");
  });

  it("西暦日付（1桁月日）を正しく変換する", () => {
    expect(parseDateFromText("2024年9月2日")).toBe("2024-09-02");
  });

  it("全角数字の西暦日付を正しく変換する", () => {
    expect(parseDateFromText("２０２４年１２月０２日")).toBe("2024-12-02");
  });

  it("和暦パターンも変換する", () => {
    expect(parseDateFromText("令和6年9月10日")).toBe("2024-09-10");
  });

  it("令和元年の和暦を正しく変換する", () => {
    expect(parseDateFromText("令和元年5月1日")).toBe("2019-05-01");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseDateFromText("会議録一覧")).toBeNull();
  });
});
