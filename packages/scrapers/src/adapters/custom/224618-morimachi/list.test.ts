import { describe, it, expect } from "vitest";
import { parseIndexPage, parseYearPage } from "./list";

describe("parseIndexPage", () => {
  it("インデックスページから年度別ページの URL を抽出する", () => {
    const html = `
      <div class="pageLink">
        <a href="/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/5/5855.html">【令和6年度】会議録</a>
      </div>
      <div class="pageLink">
        <a href="/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/5/5552.html">【令和5年度】会議録</a>
      </div>
      <div class="pageLink">
        <a href="/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/5/5543.html">【平成31年度】会議録</a>
      </div>
    `;

    const urls = parseIndexPage(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe(
      "https://www.town.morimachi.shizuoka.jp/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/5/5855.html"
    );
    expect(urls[1]).toBe(
      "https://www.town.morimachi.shizuoka.jp/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/5/5552.html"
    );
    expect(urls[2]).toBe(
      "https://www.town.morimachi.shizuoka.jp/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/5/5543.html"
    );
  });

  it("会議録以外のリンクは含めない", () => {
    const html = `
      <a href="/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/5/5855.html">【令和6年度】会議録</a>
      <a href="/gyosei/other/page.html">その他のページ</a>
      <a href="/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/456.html">トップ</a>
    `;

    const urls = parseIndexPage(html);

    expect(urls).toHaveLength(1);
  });

  it("プロトコル相対 URL を https に変換する", () => {
    const html = `
      <a href="//www.town.morimachi.shizuoka.jp/gyosei/path/5855.html">【令和6年度】会議録</a>
    `;

    const urls = parseIndexPage(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://www.town.morimachi.shizuoka.jp/gyosei/path/5855.html"
    );
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `
      <a href="https://www.town.morimachi.shizuoka.jp/gyosei/path/5855.html">【令和6年度】会議録</a>
    `;

    const urls = parseIndexPage(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://www.town.morimachi.shizuoka.jp/gyosei/path/5855.html"
    );
  });
});

describe("parseYearPage", () => {
  it("年度別ページから PDF リンクを抽出する", () => {
    const html = `
      <h3>令和6年12月定例会 本会議</h3>
      <a href="/material/files/group/13/R061204.pdf">令和6年12月4日 (PDFファイル: 498.6KB)</a>
      <a href="/material/files/group/13/R061218.pdf">令和6年12月18日 (PDFファイル: 532.1KB)</a>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-12-04");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.morimachi.shizuoka.jp/material/files/group/13/R061204.pdf"
    );
    expect(meetings[0]!.section).toContain("定例会");
    expect(meetings[1]!.heldOn).toBe("2024-12-18");
  });

  it("年度フィルタリング: 翌年の1〜3月は前年度として扱う", () => {
    const html = `
      <h3>令和6年9月定例会 本会議</h3>
      <a href="/material/files/group/13/R060903.pdf">令和6年9月3日 (PDFファイル: 450.0KB)</a>
      <h3>令和7年3月定例会 本会議</h3>
      <a href="/material/files/group/13/R070303.pdf">令和7年3月3日 (PDFファイル: 510.0KB)</a>
    `;

    // 令和6年度（2024年度）のページ: 9月〜翌3月が対象
    const meetings2024 = parseYearPage(html, 2024);
    expect(meetings2024).toHaveLength(2);

    // 令和7年度（2025年度）のページ
    const meetings2025 = parseYearPage(html, 2025);
    expect(meetings2025).toHaveLength(0);
  });

  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <h3>令和6年10月臨時会 本会議</h3>
      <a href="/material/files/group/13/R061023.pdf">令和6年10月23日 (PDFファイル: 210.0KB)</a>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toContain("臨時会");
    expect(meetings[0]!.heldOn).toBe("2024-10-23");
  });

  it("開催日を含まないリンクはスキップする", () => {
    const html = `
      <h3>令和6年12月定例会 本会議</h3>
      <a href="/material/files/group/13/agenda.pdf">議事日程 (PDFファイル: 100.0KB)</a>
      <a href="/material/files/group/13/R061204.pdf">令和6年12月4日 (PDFファイル: 498.6KB)</a>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-04");
  });

  it("プロトコル相対 URL を https に変換する", () => {
    const html = `
      <h3>令和6年12月定例会 本会議</h3>
      <a href="//www.town.morimachi.shizuoka.jp/material/files/group/13/R061204.pdf">令和6年12月4日 (PDFファイル: 498.6KB)</a>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.morimachi.shizuoka.jp/material/files/group/13/R061204.pdf"
    );
  });

  it("平成の日付を正しく処理する", () => {
    const html = `
      <h3>平成30年12月定例会 本会議</h3>
      <a href="/material/files/group/13/H301210.pdf">平成30年12月10日 (PDFファイル: 480.0KB)</a>
    `;

    const meetings = parseYearPage(html, 2018);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-12-10");
  });
});
