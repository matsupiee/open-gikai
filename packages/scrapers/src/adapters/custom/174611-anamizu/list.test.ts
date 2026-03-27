import { describe, expect, it } from "vitest";
import {
  cleanTitle,
  parseBacknumberPage,
  parseCurrentListPage,
  parseDateFromTitle,
} from "./list";

describe("cleanTitle", () => {
  it("PDF ファイルサイズ表記を除去する", () => {
    expect(cleanTitle("第1回3月定例会 [PDFファイル／495KB]")).toBe(
      "第1回3月定例会"
    );
  });

  it("余分な [ を含む壊れた表記も除去する", () => {
    expect(cleanTitle("第3回6月定例会[ [PDFファイル／496KB]")).toBe(
      "第3回6月定例会"
    );
  });
});

describe("parseDateFromTitle", () => {
  it("月付きの定例会タイトルを YYYY-MM-01 に変換する", () => {
    expect(parseDateFromTitle("第1回3月定例会", 2025)).toBe("2025-03-01");
  });

  it("月付きの臨時会タイトルを YYYY-MM-01 に変換する", () => {
    expect(parseDateFromTitle("第3回7月臨時会", 2025)).toBe("2025-07-01");
  });

  it("月情報のないタイトルは null を返す", () => {
    expect(parseDateFromTitle("第2回定例会", 2010)).toBeNull();
  });
});

describe("parseCurrentListPage", () => {
  it("年度別テーブルから対象年の PDF リンクを抽出する", () => {
    const html = `
      <table class="tbl">
        <tr>
          <th>令和7年</th>
          <th>令和8年</th>
        </tr>
        <tr>
          <td>
            <a href="/uploaded/attachment/104309.pdf">第1回3月定例会 [PDFファイル／1.86MB]</a><br>
            <a href="https://youtu.be/example">一般質問動画</a>
          </td>
          <td><a href="/uploaded/attachment/105593.pdf">第1回2月臨時会 [PDFファイル／214KB]</a></td>
        </tr>
        <tr>
          <td><a href="/uploaded/attachment/104563.pdf">第2回6月定例会 [PDFファイル／1.14MB]</a></td>
          <td>&nbsp;</td>
        </tr>
      </table>
    `;

    const meetings = parseCurrentListPage(html, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("第1回3月定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.anamizu.lg.jp/uploaded/attachment/104309.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2025-03-01");
    expect(meetings[1]!.title).toBe("第2回6月定例会");
    expect(meetings[1]!.heldOn).toBe("2025-06-01");
  });
});

describe("parseBacknumberPage", () => {
  it("バックナンバーの h3 セクションから PDF リンクを抽出する", () => {
    const html = `
      <h3>平成31年（令和元年）</h3>
      <p>
        <a href="/uploaded/attachment/104054.pdf">第1回定例会 [PDFファイル／4.95MB]</a><br>
        <a href="/uploaded/attachment/104059.pdf">第4回7月臨時会 [PDFファイル／119KB]</a>
      </p>
      <h3>令和2年</h3>
      <p>
        <a href="/uploaded/attachment/104063.pdf">第1回3月定例会 [PDFファイル／486KB]</a><br>
        <a href="/uploaded/attachment/104065.pdf">第3回6月定例会[ [PDFファイル／496KB]</a>
      </p>
    `;

    const meetings = parseBacknumberPage(html, 2019);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("第1回定例会");
    expect(meetings[0]!.heldOn).toBeNull();
    expect(meetings[1]!.title).toBe("第4回7月臨時会");
    expect(meetings[1]!.heldOn).toBe("2019-07-01");
  });

  it("令和2年の壊れたリンクテキストも抽出できる", () => {
    const html = `
      <h3>令和2年</h3>
      <p>
        <a href="/uploaded/attachment/104065.pdf">第3回6月定例会[ [PDFファイル／496KB]</a>
      </p>
    `;

    const meetings = parseBacknumberPage(html, 2020);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第3回6月定例会");
    expect(meetings[0]!.heldOn).toBe("2020-06-01");
  });
});
