import { describe, expect, it } from "vitest";
import {
  extractYearFromTitle,
  parseSessionPage,
  parseTopPage,
  parseYearPage,
} from "./list";

describe("parseTopPage", () => {
  it("年別ディレクトリページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/page/dir004317.html">令和8年</a></li>
        <li><a href="/page/dir004007.html">令和7年</a></li>
        <li><a href="/page/dir003753.html">令和6年</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和8年");
    expect(pages[0]!.url).toBe(
      "https://www.town.ibaraki-sakai.lg.jp/page/dir004317.html",
    );
    expect(pages[1]!.label).toBe("令和7年");
    expect(pages[2]!.label).toBe("令和6年");
  });

  it("定例会・臨時会リンクはスキップする", () => {
    const html = `
      <a href="/page/page003930.html">令和7年第4回定例会</a>
      <a href="/page/dir004007.html">令和7年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年");
  });

  it("平成の年度リンクも抽出する", () => {
    const html = `
      <a href="/page/dir001735.html">平成30年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("平成30年");
  });

  it("令和元年リンクを抽出する", () => {
    const html = `
      <a href="/page/dir002326.html">令和元年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和元年");
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="/page/dir004007.html">令和7年</a>
      <a href="/page/dir004007.html">令和7年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("定例会ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/page/page003930.html">令和7年第4回定例会</a></li>
        <li><a href="/page/page003875.html">令和7年第3回定例会</a></li>
        <li><a href="/page/page003711.html">令和7年第1回定例会</a></li>
      </ul>
    `;

    const sessions = parseYearPage(html);

    expect(sessions).toHaveLength(3);
    expect(sessions[0]!.title).toBe("令和7年第4回定例会");
    expect(sessions[0]!.url).toBe(
      "https://www.town.ibaraki-sakai.lg.jp/page/page003930.html",
    );
    expect(sessions[1]!.title).toBe("令和7年第3回定例会");
    expect(sessions[2]!.title).toBe("令和7年第1回定例会");
  });

  it("定例会・臨時会以外のリンクはスキップする", () => {
    const html = `
      <a href="/page/page003930.html">令和7年第4回定例会</a>
      <a href="/page/page000001.html">お知らせ</a>
    `;

    const sessions = parseYearPage(html);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.title).toBe("令和7年第4回定例会");
  });

  it("臨時会も抽出する", () => {
    const html = `
      <a href="/page/page003800.html">令和7年第1回臨時会</a>
    `;

    const sessions = parseYearPage(html);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.title).toBe("令和7年第1回臨時会");
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="/page/page003930.html">令和7年第4回定例会</a>
      <a href="/page/page003930.html">令和7年第4回定例会</a>
    `;

    const sessions = parseYearPage(html);
    expect(sessions).toHaveLength(1);
  });
});

describe("parseSessionPage", () => {
  it("質問者名と PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>1</td>
          <td><a href="/data/doc/1773276029_doc_88_0.pdf">枝　史子</a></td>
          <td>一般質問の内容</td>
        </tr>
        <tr>
          <td>2</td>
          <td><a href="/data/doc/1773276030_doc_88_0.pdf">鈴木　太郎</a></td>
          <td>別の質問</td>
        </tr>
      </table>
    `;

    const pairs = parseSessionPage(html);

    expect(pairs).toHaveLength(2);
    expect(pairs[0]!.questioner).toBe("枝　史子");
    expect(pairs[0]!.pdfUrl).toBe(
      "https://www.town.ibaraki-sakai.lg.jp/data/doc/1773276029_doc_88_0.pdf",
    );
    expect(pairs[1]!.questioner).toBe("鈴木　太郎");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <p>現在会議録はありません。</p>
    `;

    const pairs = parseSessionPage(html);
    expect(pairs).toHaveLength(0);
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <a href="/data/doc/1773276029_doc_88_0.pdf">枝　史子</a>
      <a href="/data/doc/1773276029_doc_88_0.pdf">枝　史子</a>
    `;

    const pairs = parseSessionPage(html);
    expect(pairs).toHaveLength(1);
  });

  it("絶対 URL の PDF リンクも処理する", () => {
    const html = `
      <a href="https://www.town.ibaraki-sakai.lg.jp/data/doc/1773276029_doc_88_0.pdf">枝　史子</a>
    `;

    const pairs = parseSessionPage(html);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.pdfUrl).toBe(
      "https://www.town.ibaraki-sakai.lg.jp/data/doc/1773276029_doc_88_0.pdf",
    );
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和7年第4回定例会")).toBe(2025);
  });

  it("令和元年を 2019 に変換する", () => {
    expect(extractYearFromTitle("令和元年第3回定例会")).toBe(2019);
  });

  it("平成30年を 2018 に変換する", () => {
    expect(extractYearFromTitle("平成30年第1回定例会")).toBe(2018);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("お知らせ")).toBeNull();
  });
});
