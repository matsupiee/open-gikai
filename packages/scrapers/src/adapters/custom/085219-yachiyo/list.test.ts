import { describe, expect, it } from "vitest";
import {
  extractYearFromTitle,
  parseMeetingPage,
  parseTopPage,
  parseYearPage,
} from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/page/dir012601.html">令和8年</a></li>
        <li><a href="/page/dir011665.html">令和7年</a></li>
        <li><a href="/page/dir010016.html">令和6年</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和8年");
    expect(pages[0]!.url).toBe("https://www.town.ibaraki-yachiyo.lg.jp/page/dir012601.html");
    expect(pages[1]!.label).toBe("令和7年");
    expect(pages[2]!.label).toBe("令和6年");
  });

  it("定例会・臨時会リンクはスキップする", () => {
    const html = `
      <a href="/page/page010017.html">令和6年第4回定例会</a>
      <a href="/page/dir010016.html">令和6年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和6年");
  });

  it("平成の年度リンクも抽出する", () => {
    const html = `
      <a href="/page/dir003867.html">平成31年・令和元年</a>
      <a href="/page/dir002022.html">平成30年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.label).toBe("平成31年・令和元年");
    expect(pages[1]!.label).toBe("平成30年");
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="/page/dir010016.html">令和6年</a>
      <a href="/page/dir010016.html">令和6年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
  });

  it("和暦を含まないリンクはスキップする", () => {
    const html = `
      <a href="/page/dir010016.html">審議結果・会議録</a>
      <a href="/page/dir011665.html">令和7年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年");
  });
});

describe("parseYearPage", () => {
  it("個別会議ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/page/page010017.html">令和6年第4回（12月）定例会</a></li>
        <li><a href="/page/page009123.html">令和6年第3回（9月）定例会</a></li>
        <li><a href="/page/page008500.html">令和6年第1回（1月）臨時会</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.title).toBe("令和6年第4回（12月）定例会");
    expect(meetings[0]!.url).toBe("https://www.town.ibaraki-yachiyo.lg.jp/page/page010017.html");
    expect(meetings[1]!.title).toBe("令和6年第3回（9月）定例会");
    expect(meetings[2]!.title).toBe("令和6年第1回（1月）臨時会");
  });

  it("定例会・臨時会以外のリンクはスキップする", () => {
    const html = `
      <a href="/page/page010017.html">令和6年第4回定例会</a>
      <a href="/page/page000001.html">お知らせ</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年第4回定例会");
  });

  it("相対パスを絶対 URL に変換する", () => {
    const html = `
      <a href="../page/page010017.html">令和6年第4回定例会</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings[0]!.url).toBe(
      "https://www.town.ibaraki-yachiyo.lg.jp/page/page010017.html",
    );
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="/page/page010017.html">令和6年第4回定例会</a>
      <a href="/page/page010017.html">令和6年第4回定例会</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });
});

describe("parseMeetingPage", () => {
  it("会議録 PDF リンクを抽出し、審議結果を除外する", () => {
    const html = `
      <table>
        <tr>
          <td>第1号</td>
          <td>12月5日（木）</td>
          <td>開会、議案審議</td>
          <td><a href="../data/doc/1745820928_doc_62_0.pdf">会議録（第1号）</a></td>
        </tr>
        <tr>
          <td>第2号</td>
          <td>12月11日（水）</td>
          <td>一般質問</td>
          <td><a href="../data/doc/1745820950_doc_62_0.pdf">会議録（第2号）</a></td>
        </tr>
        <tr>
          <td>審議結果</td>
          <td>-</td>
          <td>-</td>
          <td><a href="../data/doc/1735011254_doc_62_0.pdf">審議結果</a></td>
        </tr>
      </table>
    `;

    const pdfUrls = parseMeetingPage(html);

    expect(pdfUrls).toHaveLength(2);
    expect(pdfUrls[0]).toBe(
      "https://www.town.ibaraki-yachiyo.lg.jp/data/doc/1745820928_doc_62_0.pdf",
    );
    expect(pdfUrls[1]).toBe(
      "https://www.town.ibaraki-yachiyo.lg.jp/data/doc/1745820950_doc_62_0.pdf",
    );
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <a href="../data/doc/1745820928_doc_62_0.pdf">会議録（第1号）</a>
      <a href="../data/doc/1745820928_doc_62_0.pdf">会議録（第1号）</a>
    `;

    const pdfUrls = parseMeetingPage(html);
    expect(pdfUrls).toHaveLength(1);
  });

  it("絶対 URL の PDF リンクも扱える", () => {
    const html = `
      <a href="https://www.town.ibaraki-yachiyo.lg.jp/data/doc/1745820928_doc_62_0.pdf">会議録（第1号）</a>
    `;

    const pdfUrls = parseMeetingPage(html);
    expect(pdfUrls[0]).toBe(
      "https://www.town.ibaraki-yachiyo.lg.jp/data/doc/1745820928_doc_62_0.pdf",
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<p>会議録は準備中です。</p>`;
    const pdfUrls = parseMeetingPage(html);
    expect(pdfUrls).toHaveLength(0);
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和6年第4回定例会")).toBe(2024);
  });

  it("令和元年を 2019 に変換する", () => {
    expect(extractYearFromTitle("令和元年第3回定例会")).toBe(2019);
  });

  it("平成31年を 2019 に変換する", () => {
    expect(extractYearFromTitle("平成31年第1回定例会")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromTitle("平成30年第4回定例会")).toBe(2018);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("お知らせ")).toBeNull();
  });
});
