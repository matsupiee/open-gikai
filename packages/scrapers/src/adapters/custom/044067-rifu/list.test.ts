import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("年度別ページの URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gyosei/chosei/rifuchogikai/2/6679.html">令和7年</a></li>
        <li><a href="/gyosei/chosei/rifuchogikai/2/6041.html">令和6年</a></li>
        <li><a href="/gyosei/chosei/rifuchogikai/2/5591.html">令和5年</a></li>
      </ul>
    `;

    const urls = parseTopPage(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.town.rifu.miyagi.jp/gyosei/chosei/rifuchogikai/2/6679.html");
    expect(urls[1]).toBe("https://www.town.rifu.miyagi.jp/gyosei/chosei/rifuchogikai/2/6041.html");
    expect(urls[2]).toBe("https://www.town.rifu.miyagi.jp/gyosei/chosei/rifuchogikai/2/5591.html");
  });

  it("index.html は除外する", () => {
    const html = `
      <ul>
        <li><a href="/gyosei/chosei/rifuchogikai/2/index.html">トップ</a></li>
        <li><a href="/gyosei/chosei/rifuchogikai/2/6041.html">令和6年</a></li>
      </ul>
    `;

    const urls = parseTopPage(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.rifu.miyagi.jp/gyosei/chosei/rifuchogikai/2/6041.html");
  });

  it("プロトコル相対 URL（//）を https: に変換する", () => {
    const html = `
      <a href="//www.town.rifu.miyagi.jp/gyosei/chosei/rifuchogikai/2/6041.html">令和6年</a>
    `;

    const urls = parseTopPage(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.rifu.miyagi.jp/gyosei/chosei/rifuchogikai/2/6041.html");
  });

  it("重複 URL は除外する", () => {
    const html = `
      <a href="/gyosei/chosei/rifuchogikai/2/6041.html">令和6年</a>
      <a href="/gyosei/chosei/rifuchogikai/2/6041.html">令和6年（重複）</a>
    `;

    const urls = parseTopPage(html);

    expect(urls).toHaveLength(1);
  });

  it("関係ない URL は除外する", () => {
    const html = `
      <a href="/other/page.html">他のページ</a>
      <a href="/gyosei/chosei/rifuchogikai/2/6041.html">令和6年</a>
    `;

    const urls = parseTopPage(html);

    expect(urls).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("h2 セクションから PDF リンクを抽出する", () => {
    const html = `
      <h2>令和6年12月定例会</h2>
      <ul>
        <li><a href="//www.town.rifu.miyagi.jp/material/files/group/57/20241203-1teireikai.pdf">令和6年12月3日 (PDFファイル: 752.1KB)</a></li>
      </ul>
      <h2>令和6年9月定例会</h2>
      <ul>
        <li><a href="//www.town.rifu.miyagi.jp/material/files/group/57/20240903teireikai.pdf">令和6年9月3日 (PDFファイル: 600.0KB)</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.rifu.miyagi.jp/material/files/group/57/20241203-1teireikai.pdf"
    );
    expect(meetings[0]!.title).toBe("令和6年12月定例会 令和6年12月3日");
    expect(meetings[0]!.heldOn).toBe("2024-12-03");
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.rifu.miyagi.jp/material/files/group/57/20240903teireikai.pdf"
    );
    expect(meetings[1]!.heldOn).toBe("2024-09-03");
  });

  it("臨時会の meetingType が extraordinary になる", () => {
    const html = `
      <h2>令和6年1月臨時会</h2>
      <ul>
        <li><a href="//www.town.rifu.miyagi.jp/material/files/group/57/20240126rinnjikai.pdf">令和6年1月26日 (PDFファイル: 300.0KB)</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.heldOn).toBe("2024-01-26");
  });

  it("委員会の meetingType が committee になる", () => {
    const html = `
      <h2>予算審査特別委員会</h2>
      <ul>
        <li><a href="//www.town.rifu.miyagi.jp/material/files/group/57/budget.pdf">令和6年3月4日 (PDFファイル: 400.0KB)</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("committee");
  });

  it("リンクテキストから日付解析できない場合 heldOn は null", () => {
    const html = `
      <h2>令和6年12月定例会</h2>
      <ul>
        <li><a href="//www.town.rifu.miyagi.jp/material/files/group/57/unknown.pdf">会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("令和元年を正しく変換する", () => {
    const html = `
      <h2>令和元年6月定例会</h2>
      <ul>
        <li><a href="//www.town.rifu.miyagi.jp/material/files/group/19/test.pdf">令和元年6月5日 (PDFファイル: 100.0KB)</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-06-05");
  });

  it("平成年度の日付を正しく変換する", () => {
    const html = `
      <h2>平成30年12月定例会</h2>
      <ul>
        <li><a href="//www.town.rifu.miyagi.jp/material/files/group/19/h3012.pdf">平成30年12月5日 (PDFファイル: 200.0KB)</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-12-05");
  });

  it("h2 がない場合は空配列を返す", () => {
    const html = `
      <div>
        <a href="//www.town.rifu.miyagi.jp/material/files/group/57/test.pdf">令和6年12月3日</a>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(0);
  });

  it("タイトルからファイルサイズ情報が除去される", () => {
    const html = `
      <h2>令和6年12月定例会</h2>
      <ul>
        <li><a href="//www.town.rifu.miyagi.jp/material/files/group/57/test.pdf">令和6年12月3日 (PDFファイル: 752.1KB)</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings[0]!.title).toBe("令和6年12月定例会 令和6年12月3日");
    expect(meetings[0]!.title).not.toContain("PDFファイル");
  });
});
