import { describe, expect, it } from "vitest";
import { parseYearPages, extractSessionRecords, parseSessionInfo } from "./list";

describe("parseYearPages", () => {
  it("インデックスページから年度別ページリンクを抽出する", () => {
    const html = `
      <html>
      <body>
      <ul>
        <li><a href="/soshiki/gikai/kaigiroku/4199.html">上富田町議会 令和6年 会議録</a></li>
        <li><a href="/soshiki/gikai/kaigiroku/3800.html">上富田町議会 令和5年 会議録</a></li>
        <li><a href="/soshiki/gikai/kaigiroku/3400.html">上富田町議会 令和4年 会議録</a></li>
        <li><a href="/soshiki/gikai/kaigiroku/2100.html">上富田町議会 平成31年(令和元年) 会議録</a></li>
      </ul>
      </body>
      </html>
    `;

    const pages = parseYearPages(html);

    expect(pages).toHaveLength(4);
    expect(pages[0]!.year).toBe(2024);
    expect(pages[0]!.url).toBe("http://www.town.kamitonda.lg.jp/soshiki/gikai/kaigiroku/4199.html");
    expect(pages[1]!.year).toBe(2023);
    expect(pages[2]!.year).toBe(2022);
    expect(pages[3]!.year).toBe(2019);
  });

  it("令和元年を正しく 2019 として解析する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/gikai/kaigiroku/2100.html">上富田町議会 令和元年 会議録</a></li>
      </ul>
    `;

    const pages = parseYearPages(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.year).toBe(2019);
  });

  it("年度ページが0件の場合", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const pages = parseYearPages(html);
    expect(pages).toHaveLength(0);
  });

  it("重複 URL を除外する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/gikai/kaigiroku/4199.html">上富田町議会 令和6年 会議録</a></li>
        <li><a href="/soshiki/gikai/kaigiroku/4199.html">上富田町議会 令和6年 会議録</a></li>
      </ul>
    `;

    const pages = parseYearPages(html);
    expect(pages).toHaveLength(1);
  });
});

describe("extractSessionRecords", () => {
  it("PDF リンクを抽出し目次を除外する", () => {
    const html = `
      <html>
      <body>
      <table>
        <tr>
          <td>第4回（12月）定例会 目次</td>
          <td><a href="//www.town.kamitonda.lg.jp/material/files/group/8/202412Tmokuji.pdf">目次</a></td>
        </tr>
        <tr>
          <td>第4回（12月）定例会 第1日目</td>
          <td><a href="//www.town.kamitonda.lg.jp/material/files/group/8/20241206Tgijiroku.pdf">第4回（12月）定例会 第1日目</a></td>
        </tr>
        <tr>
          <td>第4回（12月）定例会 第2日目</td>
          <td><a href="//www.town.kamitonda.lg.jp/material/files/group/8/20241216Tgijiroku.pdf">第4回（12月）定例会 第2日目</a></td>
        </tr>
      </table>
      </body>
      </html>
    `;

    const records = extractSessionRecords(html, "http://www.town.kamitonda.lg.jp/soshiki/gikai/kaigiroku/4199.html");

    expect(records).toHaveLength(2);
    expect(records[0]!.pdfUrl).toBe("http://www.town.kamitonda.lg.jp/material/files/group/8/20241206Tgijiroku.pdf");
    expect(records[0]!.heldOn).toBe("2024-12-06");
    expect(records[0]!.meetingType).toBe("plenary");
    expect(records[1]!.pdfUrl).toBe("http://www.town.kamitonda.lg.jp/material/files/group/8/20241216Tgijiroku.pdf");
    expect(records[1]!.heldOn).toBe("2024-12-16");
  });

  it("臨時会を正しく検出する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="//www.town.kamitonda.lg.jp/material/files/group/8/202405Rgijiroku.pdf">第2回（5月）臨時会 第1日目</a></td>
        </tr>
      </table>
    `;

    const records = extractSessionRecords(html, "http://www.town.kamitonda.lg.jp/soshiki/gikai/kaigiroku/4199.html");

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("extraordinary");
    // 月のみのファイル名なので heldOn は null
    expect(records[0]!.heldOn).toBeNull();
  });

  it("重複 PDF URL を除外する", () => {
    const html = `
      <table>
        <tr><td><a href="//www.town.kamitonda.lg.jp/material/files/group/8/20241206Tgijiroku.pdf">第1日目</a></td></tr>
        <tr><td><a href="//www.town.kamitonda.lg.jp/material/files/group/8/20241206Tgijiroku.pdf">第1日目</a></td></tr>
      </table>
    `;

    const records = extractSessionRecords(html, "http://www.town.kamitonda.lg.jp/soshiki/gikai/kaigiroku/4199.html");
    expect(records).toHaveLength(1);
  });
});

describe("parseSessionInfo", () => {
  it("日付付きファイル名（yyyymmdd）から heldOn を取得する", () => {
    const result = parseSessionInfo("第4回（12月）定例会 第1日目", "20241206Tgijiroku.pdf");
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-12-06");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.title).toBe("第4回（12月）定例会 第1日目");
  });

  it("月のみファイル名（yyyymm）では heldOn が null", () => {
    const result = parseSessionInfo("第2回（5月）臨時会 第1日目", "202405Rgijiroku.pdf");
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("空のリンクテキストは null を返す", () => {
    const result = parseSessionInfo("", "20241206Tgijiroku.pdf");
    expect(result).toBeNull();
  });
});
