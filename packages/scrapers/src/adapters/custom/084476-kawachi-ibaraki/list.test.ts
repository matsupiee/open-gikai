import { describe, expect, it } from "vitest";
import { parseIndexPage, parseYearPage, extractPdfId } from "./list";
import { parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和6年を2024に変換する", () => {
    expect(parseWarekiYear("令和6年")).toBe(2024);
  });

  it("令和元年を2019に変換する", () => {
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("令和7年を2025に変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
  });

  it("平成30年を2018に変換する", () => {
    expect(parseWarekiYear("平成30年")).toBe(2018);
  });

  it("平成24年を2012に変換する", () => {
    expect(parseWarekiYear("平成24年")).toBe(2012);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("parseIndexPage", () => {
  it("div.dirIndex から年度とURLを抽出する", () => {
    const html = `
      <div id="dir">
        <div class="dirIndex">
          <h3>令和7年</h3>
          <p><a href="page002683.html">令和7年会議録</a></p>
        </div>
        <div class="dirIndex">
          <h3>令和6年</h3>
          <p><a href="page002269.html">令和6年会議録</a></p>
        </div>
        <div class="dirIndex">
          <h3>平成24年</h3>
          <p><a href="page000244.html">平成24年会議録</a></p>
        </div>
      </div>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      year: 2025,
      url: "https://www.town.ibaraki-kawachi.lg.jp/page/page002683.html",
    });
    expect(result[1]).toEqual({
      year: 2024,
      url: "https://www.town.ibaraki-kawachi.lg.jp/page/page002269.html",
    });
    expect(result[2]).toEqual({
      year: 2012,
      url: "https://www.town.ibaraki-kawachi.lg.jp/page/page000244.html",
    });
  });

  it("絶対URLのhrefをそのまま使う", () => {
    const html = `
      <div class="dirIndex">
        <h3>令和6年</h3>
        <a href="https://www.town.ibaraki-kawachi.lg.jp/page/page002269.html">令和6年</a>
      </div>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(
      "https://www.town.ibaraki-kawachi.lg.jp/page/page002269.html"
    );
  });

  it("年度リンクがない場合は空配列を返す", () => {
    const html = "<p>コンテンツなし</p>";
    expect(parseIndexPage(html)).toEqual([]);
  });

  it("同じ年の重複を除外する", () => {
    const html = `
      <div class="dirIndex">
        <h3>令和6年</h3>
        <a href="page002269.html">令和6年</a>
      </div>
      <div class="dirIndex">
        <h3>令和6年</h3>
        <a href="page002270.html">令和6年（別）</a>
      </div>
    `;

    const result = parseIndexPage(html);
    expect(result).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("定例会の初日と最終日のPDFリンクを抽出する", () => {
    const html = `
      <div id="contents">
        <h3>第4回（12月）定例会</h3>
        <table>
          <tbody>
            <tr>
              <th>形式</th>
              <th>会議録ファイル名</th>
              <th>形式</th>
              <th>会議録ファイル名</th>
            </tr>
            <tr>
              <td><img src="pdf.gif" /></td>
              <td>
                初日
                <a href="https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565205_doc_11_0.pdf">
                  初日
                </a>
                （PDF形式／390KB）
              </td>
              <td><img src="pdf.gif" /></td>
              <td>
                <a href="https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565241_doc_11_0.pdf">
                  最終日
                </a>
                （PDF形式／635KB）
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      sessionName: "第4回（12月）定例会",
      label: "初日",
      pdfUrl:
        "https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565205_doc_11_0.pdf",
    });
    expect(result[1]).toEqual({
      sessionName: "第4回（12月）定例会",
      label: "最終日",
      pdfUrl:
        "https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565241_doc_11_0.pdf",
    });
  });

  it("臨時会の1ファイルを抽出する", () => {
    const html = `
      <div id="contents">
        <h3>第3回（11月）臨時会</h3>
        <table>
          <tbody>
            <tr>
              <th>形式</th>
              <th colspan="3">会議録ファイル名</th>
            </tr>
            <tr>
              <td><img src="pdf.gif" /></td>
              <td colspan="3">
                <a href="https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565105_doc_11_0.pdf">
                  初日
                </a>
                （PDF形式／245KB）
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      sessionName: "第3回（11月）臨時会",
      label: "初日",
      pdfUrl:
        "https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565105_doc_11_0.pdf",
    });
  });

  it("複数の会議セクションを正しく処理する", () => {
    const html = `
      <div id="contents">
        <h3>第4回（12月）定例会</h3>
        <table>
          <tbody>
            <tr>
              <td><a href="https://example.com/doc1.pdf">初日</a></td>
              <td><a href="https://example.com/doc2.pdf">最終日</a></td>
            </tr>
          </tbody>
        </table>
        <h3>第3回（11月）臨時会</h3>
        <table>
          <tbody>
            <tr>
              <td><a href="https://example.com/doc3.pdf">初日</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const result = parseYearPage(html, 2024);

    expect(result).toHaveLength(3);
    expect(result[0]!.sessionName).toBe("第4回（12月）定例会");
    expect(result[1]!.sessionName).toBe("第4回（12月）定例会");
    expect(result[2]!.sessionName).toBe("第3回（11月）臨時会");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `
      <div id="contents">
        <h3>第4回（12月）定例会</h3>
        <table><tbody><tr><td>準備中</td></tr></tbody></table>
      </div>
    `;

    const result = parseYearPage(html, 2024);
    expect(result).toEqual([]);
  });
});

describe("extractPdfId", () => {
  it("タイムスタンプ形式のファイル名を抽出する", () => {
    expect(
      extractPdfId(
        "https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565205_doc_11_0.pdf"
      )
    ).toBe("1738565205_doc_11_0");
  });

  it("URLが解析できない場合はURLをそのまま返す", () => {
    const url = "invalid-url";
    expect(extractPdfId(url)).toBe(url);
  });
});
