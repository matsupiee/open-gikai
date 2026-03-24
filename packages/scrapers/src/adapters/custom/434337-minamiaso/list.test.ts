import { describe, it, expect } from "vitest";
import {
  parseTitleDate,
  parseMainListPage,
  parseYearListPage,
  parseDetailPage,
} from "./list";

describe("parseTitleDate", () => {
  it("令和6年12月の会議録を解析する", () => {
    expect(parseTitleDate("令和6年第4回（12月）定例会会議録")).toBe(
      "2024-12-01"
    );
  });

  it("令和6年3月の会議録を解析する", () => {
    expect(parseTitleDate("令和6年第1回（3月）定例会会議録")).toBe(
      "2024-03-01"
    );
  });

  it("令和6年1月の臨時会を解析する", () => {
    expect(parseTitleDate("令和6年第1回（1月）臨時会議録")).toBe("2024-01-01");
  });

  it("令和元年を解析する", () => {
    expect(parseTitleDate("令和元年第3回（9月）定例会会議録")).toBe(
      "2019-09-01"
    );
  });

  it("平成の会議録を解析する", () => {
    expect(parseTitleDate("平成30年第4回（12月）定例会会議録")).toBe(
      "2018-12-01"
    );
  });

  it("日付情報がない場合は null を返す", () => {
    expect(parseTitleDate("会議録")).toBeNull();
  });

  it("月情報がない場合は null を返す", () => {
    expect(parseTitleDate("令和6年第4回定例会会議録")).toBeNull();
  });
});

describe("parseMainListPage", () => {
  it("protocol-relative URL の list リンクを抽出する（list00576 自身は除外する）", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="//www.vill.minamiaso.lg.jp/gikai/list00576.html">会議録一覧</a></li>
          <li><a href="//www.vill.minamiaso.lg.jp/gikai/list00579.html">令和6年</a></li>
          <li><a href="//www.vill.minamiaso.lg.jp/gikai/list00578.html">令和5年</a></li>
          <li><a href="//www.vill.minamiaso.lg.jp/gikai/list00595.html">令和7年</a></li>
        </ul>
      </body>
      </html>
    `;

    const urls = parseMainListPage(html);

    expect(urls).toHaveLength(3);
    expect(urls).toContain(
      "https://www.vill.minamiaso.lg.jp/gikai/list00579.html"
    );
    expect(urls).toContain(
      "https://www.vill.minamiaso.lg.jp/gikai/list00578.html"
    );
    expect(urls).toContain(
      "https://www.vill.minamiaso.lg.jp/gikai/list00595.html"
    );
    // list00576 自身は含まれない
    expect(urls).not.toContain(
      "https://www.vill.minamiaso.lg.jp/gikai/list00576.html"
    );
  });

  it("重複 URL は除外する", () => {
    const html = `
      <a href="//www.vill.minamiaso.lg.jp/gikai/list00579.html">令和6年</a>
      <a href="//www.vill.minamiaso.lg.jp/gikai/list00579.html">令和6年（再掲）</a>
    `;

    const urls = parseMainListPage(html);
    expect(urls).toHaveLength(1);
  });

  it("list リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>リンクなし</p></body></html>`;
    const urls = parseMainListPage(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearListPage", () => {
  it("kiji リンクとタイトルを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/index.html">令和6年第4回（12月）定例会会議録</a></li>
          <li><a href="https://www.vill.minamiaso.lg.jp/gikai/kiji0033810/index.html">令和6年第3回（9月）定例会会議録</a></li>
          <li><a href="https://www.vill.minamiaso.lg.jp/gikai/kiji0033809/index.html">令和6年第2回（7月）臨時会会議録</a></li>
        </ul>
      </body>
      </html>
    `;

    const results = parseYearListPage(html);

    expect(results).toHaveLength(3);
    expect(results[0]!.kijiId).toBe("0033811");
    expect(results[0]!.detailUrl).toBe(
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/index.html"
    );
    expect(results[0]!.title).toBe("令和6年第4回（12月）定例会会議録");
    expect(results[1]!.kijiId).toBe("0033810");
    expect(results[1]!.title).toBe("令和6年第3回（9月）定例会会議録");
    expect(results[2]!.kijiId).toBe("0033809");
    expect(results[2]!.title).toBe("令和6年第2回（7月）臨時会会議録");
  });

  it("重複 URL は除外する", () => {
    const html = `
      <a href="https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/index.html">令和6年第4回</a>
      <a href="https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/index.html">令和6年第4回（再掲）</a>
    `;

    const results = parseYearListPage(html);
    expect(results).toHaveLength(1);
  });

  it("kiji リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>リンクなし</p></body></html>`;
    const results = parseYearListPage(html);
    expect(results).toHaveLength(0);
  });
});

describe("parseDetailPage", () => {
  it("PDF リンクを抽出する（相対パス）", () => {
    const html = `
      <html>
      <body>
        <p><a href="3_3811_8978_up_mp6srzku.pdf">会議録 PDF（565.6 KB）</a></p>
      </body>
      </html>
    `;
    const detailUrl =
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/index.html";

    const result = parseDetailPage(html, detailUrl);

    expect(result).not.toBeNull();
    expect(result!.pdfUrl).toBe(
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/3_3811_8978_up_mp6srzku.pdf"
    );
  });

  it("絶対パスの PDF リンクも正しく処理する", () => {
    const html = `
      <html>
      <body>
        <a href="/gikai/kiji0030000/abc123.pdf">会議録</a>
      </body>
      </html>
    `;
    const detailUrl =
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0030000/index.html";

    const result = parseDetailPage(html, detailUrl);

    expect(result).not.toBeNull();
    expect(result!.pdfUrl).toBe(
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0030000/abc123.pdf"
    );
  });

  it("完全 URL の PDF リンクをそのまま使用する", () => {
    const html = `
      <html>
      <body>
        <a href="https://www.vill.minamiaso.lg.jp/gikai/kiji0033800/abc.pdf">PDF</a>
      </body>
      </html>
    `;
    const detailUrl =
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0033800/index.html";

    const result = parseDetailPage(html, detailUrl);
    expect(result!.pdfUrl).toBe(
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0033800/abc.pdf"
    );
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `
      <html>
      <body><p>PDF はありません</p></body>
      </html>
    `;
    const detailUrl =
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/index.html";

    const result = parseDetailPage(html, detailUrl);
    expect(result).toBeNull();
  });

  it("protocol-relative の PDF リンクを処理する", () => {
    const html = `
      <html>
      <body>
        <a href="//www.vill.minamiaso.lg.jp/gikai/kiji0033811/abc.pdf">PDF</a>
      </body>
      </html>
    `;
    const detailUrl =
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/index.html";

    const result = parseDetailPage(html, detailUrl);
    expect(result!.pdfUrl).toBe(
      "https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/abc.pdf"
    );
  });
});
