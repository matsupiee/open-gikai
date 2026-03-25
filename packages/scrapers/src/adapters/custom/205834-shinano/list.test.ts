import { describe, expect, it } from "vitest";
import { findYearPageUrls, parseTopPageLinks, parseYearPage } from "./list";

describe("parseTopPageLinks", () => {
  it("議会トップページから年度別一覧ページへのリンクを抽出する", () => {
    const html = `
      <h2><a href="/docs/11832136.html">令和６年　信濃町議会</a></h2>
      <h2><a href="/docs/12589426.html">令和７年　信濃町議会</a></h2>
      <h2><a href="/docs/9402094.html">令和４年　信濃町議会</a></h2>
    `;

    const links = parseTopPageLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.url).toBe(
      "https://www.town.shinano.lg.jp/docs/11832136.html"
    );
    expect(links[0]!.text).toBe("令和６年 信濃町議会");
    expect(links[1]!.url).toBe(
      "https://www.town.shinano.lg.jp/docs/12589426.html"
    );
  });

  it("和暦を含まないリンクはスキップする", () => {
    const html = `
      <a href="/docs/99999.html">お知らせ</a>
      <a href="/docs/11832136.html">令和６年 信濃町議会</a>
    `;

    const links = parseTopPageLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe(
      "https://www.town.shinano.lg.jp/docs/11832136.html"
    );
  });

  it("同じ URL の重複は除去する", () => {
    const html = `
      <a href="/docs/11832136.html">令和６年 信濃町議会</a>
      <a href="/docs/11832136.html">令和６年 信濃町議会</a>
    `;

    const links = parseTopPageLinks(html);
    expect(links).toHaveLength(1);
  });

  it("平成の年度も抽出する（全角数字）", () => {
    const html = `
      <a href="/docs/5000.html">平成３０年 信濃町議会</a>
    `;

    const links = parseTopPageLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.text).toBe("平成３０年 信濃町議会");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseTopPageLinks("")).toEqual([]);
  });
});

describe("findYearPageUrls", () => {
  it("指定年に対応するページ URL を返す", () => {
    const links = [
      {
        url: "https://www.town.shinano.lg.jp/docs/11832136.html",
        text: "令和６年　信濃町議会",
      },
      {
        url: "https://www.town.shinano.lg.jp/docs/12589426.html",
        text: "令和７年　信濃町議会",
      },
    ];

    const urls = findYearPageUrls(links, 2024);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://www.town.shinano.lg.jp/docs/11832136.html"
    );
  });

  it("2019年は令和元年と平成31年の両方にマッチする", () => {
    const links = [
      {
        url: "https://www.town.shinano.lg.jp/docs/1001.html",
        text: "令和元年 信濃町議会",
      },
      {
        url: "https://www.town.shinano.lg.jp/docs/1002.html",
        text: "平成31年 信濃町議会",
      },
      {
        url: "https://www.town.shinano.lg.jp/docs/1003.html",
        text: "令和2年 信濃町議会",
      },
    ];

    const urls = findYearPageUrls(links, 2019);
    expect(urls).toHaveLength(2);
    expect(urls).toContain("https://www.town.shinano.lg.jp/docs/1001.html");
    expect(urls).toContain("https://www.town.shinano.lg.jp/docs/1002.html");
  });

  it("全角数字を含むリンクテキストでも正しくマッチする", () => {
    const links = [
      {
        url: "https://www.town.shinano.lg.jp/docs/11832136.html",
        text: "令和６年　信濃町議会",
      },
    ];

    const urls = findYearPageUrls(links, 2024);
    expect(urls).toHaveLength(1);
  });

  it("対応する年がない場合は空配列を返す", () => {
    const links = [
      {
        url: "https://www.town.shinano.lg.jp/docs/11832136.html",
        text: "令和６年 信濃町議会",
      },
    ];

    const urls = findYearPageUrls(links, 2020);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("一般質問会議録テーブルから PDF リンクを抽出する", () => {
    const html = `
      <h1>第422回信濃町議会定例会 12月会議</h1>
      <table>
        <caption>一般質問会議録</caption>
        <thead><tr><th>通告順</th><th>質問者</th></tr></thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><a href="/fs/7/9/2/5/2/4/_/1.________.pdf">1.北村 富貴夫議員 (PDF 282KB)</a></td>
          </tr>
          <tr>
            <td>2</td>
            <td><a href="/fs/7/9/2/5/2/5/_/2.______.pdf">2.酒井 聡議員 (PDF 305KB)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const files = parseYearPage(html, 2024);

    expect(files).toHaveLength(2);
    expect(files[0]!.fileUrl).toBe(
      "https://www.town.shinano.lg.jp/fs/7/9/2/5/2/4/_/1.________.pdf"
    );
    expect(files[0]!.fileType).toBe("pdf");
    expect(files[0]!.year).toBe(2024);
    expect(files[0]!.month).toBe(12);
    expect(files[0]!.sessionNumber).toBe("第422回");
    expect(files[0]!.heldOn).toBe("2024-12-01");
  });

  it("DOCX ファイルを正しく検出する", () => {
    const html = `
      <h1>第420回信濃町議会定例会 3月会議</h1>
      <table>
        <caption>一般質問会議録</caption>
        <tbody>
          <tr>
            <td>1</td>
            <td><a href="/fs/1/2/3/4/5/6/_/question.docx">1.田中 太郎議員 (DOCX)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const files = parseYearPage(html, 2022);

    expect(files).toHaveLength(1);
    expect(files[0]!.fileType).toBe("docx");
    expect(files[0]!.month).toBe(3);
  });

  it("DOC ファイルを正しく検出する", () => {
    const html = `
      <h1>第420回信濃町議会定例会 3月会議</h1>
      <table>
        <caption>一般質問会議録</caption>
        <tbody>
          <tr>
            <td>1</td>
            <td><a href="/fs/1/2/3/4/5/6/_/question.doc">1.田中 太郎議員 (DOC)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const files = parseYearPage(html, 2022);

    expect(files).toHaveLength(1);
    expect(files[0]!.fileType).toBe("doc");
  });

  it("caption が「一般質問会議録」でないテーブルはスキップする", () => {
    const html = `
      <h1>第422回信濃町議会定例会 12月会議</h1>
      <table>
        <caption>議案審議結果</caption>
        <tbody>
          <tr><td><a href="/fs/1/2/3/_/bill.pdf">議案審議結果 (PDF)</a></td></tr>
        </tbody>
      </table>
      <table>
        <caption>一般質問会議録</caption>
        <tbody>
          <tr>
            <td>1</td>
            <td><a href="/fs/1/2/4/_/member.pdf">1.北村 富貴夫議員 (PDF)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const files = parseYearPage(html, 2024);

    expect(files).toHaveLength(1);
    expect(files[0]!.fileUrl).toContain("member.pdf");
  });

  it("heldOn は月の 1 日に設定される", () => {
    const html = `
      <h1>第424回信濃町議会定例会 12月会議</h1>
      <table>
        <caption>一般質問会議録</caption>
        <tbody>
          <tr><td>1</td><td><a href="/fs/1/2/3/_/q.pdf">1.議員名 (PDF)</a></td></tr>
        </tbody>
      </table>
    `;

    const files = parseYearPage(html, 2024);

    expect(files[0]!.heldOn).toBe("2024-12-01");
  });

  it("複数の会議セクションを正しく処理する", () => {
    const html = `
      <h1>第422回信濃町議会定例会 12月会議</h1>
      <table>
        <caption>一般質問会議録</caption>
        <tbody>
          <tr><td>1</td><td><a href="/fs/1/2/3/_/dec.pdf">1.北村 富貴夫議員 (PDF)</a></td></tr>
        </tbody>
      </table>
      <h1>第422回信濃町議会定例会 9月会議</h1>
      <table>
        <caption>一般質問会議録</caption>
        <tbody>
          <tr><td>1</td><td><a href="/fs/1/2/4/_/sep.pdf">1.酒井 聡議員 (PDF)</a></td></tr>
        </tbody>
      </table>
    `;

    const files = parseYearPage(html, 2024);

    expect(files).toHaveLength(2);
    expect(files[0]!.month).toBe(12);
    expect(files[0]!.heldOn).toBe("2024-12-01");
    expect(files[1]!.month).toBe(9);
    expect(files[1]!.heldOn).toBe("2024-09-01");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseYearPage("", 2024)).toEqual([]);
  });

  it("meetingType が臨時会の場合 extraordinary になる", () => {
    const html = `
      <h1>第420回信濃町議会 臨時会議 3月</h1>
      <table>
        <caption>一般質問会議録</caption>
        <tbody>
          <tr><td>1</td><td><a href="/fs/1/2/3/_/q.pdf">1.議員名 (PDF)</a></td></tr>
        </tbody>
      </table>
    `;

    const files = parseYearPage(html, 2024);

    expect(files[0]!.meetingType).toBe("extraordinary");
  });
});
