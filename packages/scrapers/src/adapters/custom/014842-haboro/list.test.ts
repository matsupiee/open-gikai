import { describe, expect, it } from "vitest";
import { parseYearPage } from "./list";
import { parseDateText } from "./shared";

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("令和6年3月12日")).toBe("2024-03-12");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("平成25年3月11日")).toBe("2013-03-11");
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("平成元年4月1日")).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("議事録一覧")).toBeNull();
  });
});

describe("parseYearPage (PDF format)", () => {
  it("テーブル内の PDF リンクを抽出する", () => {
    const html = `
      <html><body>
      <h3>第1回定例会</h3>
      <table>
        <tr>
          <td>令和6年3月12日</td>
          <td><a href="files/060312T.pdf">会議録</a></td>
        </tr>
        <tr>
          <td>令和6年3月13日</td>
          <td><a href="files/060313Y.pdf">会議録</a></td>
        </tr>
      </table>
      </body></html>
    `;

    const meetings = parseYearPage(
      html,
      "https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/R06kaigiroku.html",
      "pdf"
    );

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-03-12");
    expect(meetings[0]!.url).toBe(
      "https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/files/060312T.pdf"
    );
    expect(meetings[0]!.format).toBe("pdf");

    expect(meetings[1]!.heldOn).toBe("2024-03-13");
  });

  it("セクション見出しからセクションを検出する", () => {
    const html = `
      <html><body>
      <h3>第2回臨時会</h3>
      <table>
        <tr>
          <td>令和6年5月15日</td>
          <td><a href="files/060515R.pdf">会議録</a></td>
        </tr>
      </table>
      </body></html>
    `;

    const meetings = parseYearPage(
      html,
      "https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/R06kaigiroku.html",
      "pdf"
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("第2回臨時会");
  });

  it("日付を含まない行はスキップする", () => {
    const html = `
      <html><body>
      <table>
        <tr>
          <td>資料一覧</td>
          <td><a href="files/shiryou.pdf">資料</a></td>
        </tr>
        <tr>
          <td>令和6年6月10日</td>
          <td><a href="files/060610T.pdf">会議録</a></td>
        </tr>
      </table>
      </body></html>
    `;

    const meetings = parseYearPage(
      html,
      "https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/R06kaigiroku.html",
      "pdf"
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-06-10");
  });

  it("リスト形式の PDF リンクも抽出する", () => {
    const html = `
      <html><body>
      <ul>
        <li><a href="files/060312T.pdf">令和6年3月12日 定例会</a></li>
      </ul>
      </body></html>
    `;

    const meetings = parseYearPage(
      html,
      "https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/R06kaigiroku.html",
      "pdf"
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-12");
  });
});

describe("parseYearPage (HTML format)", () => {
  it("HTML 会議録リンクを抽出する", () => {
    const html = `
      <html><body>
      <ul>
        <li><a href="h24-01-0306.html">平成24年3月6日 第1回定例会</a></li>
        <li><a href="h24-01-0307.html">平成24年3月7日 第1回定例会</a></li>
      </ul>
      </body></html>
    `;

    const meetings = parseYearPage(
      html,
      "https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/h24/index.html",
      "html"
    );

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2012-03-06");
    expect(meetings[0]!.url).toBe(
      "https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/h24/h24-01-0306.html"
    );
    expect(meetings[0]!.format).toBe("html");
  });

  it("index.html はスキップする", () => {
    const html = `
      <html><body>
      <ul>
        <li><a href="index.html">トップに戻る</a></li>
        <li><a href="h24-01-0306.html">平成24年3月6日 第1回定例会</a></li>
      </ul>
      </body></html>
    `;

    const meetings = parseYearPage(
      html,
      "https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/h24/index.html",
      "html"
    );

    expect(meetings).toHaveLength(1);
  });
});
