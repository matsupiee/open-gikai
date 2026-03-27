import { describe, expect, it } from "vitest";
import {
  parseYearFromHeading,
  parseSessionLabel,
  parseDayNumber,
  parseListPage,
} from "./list";

describe("parseYearFromHeading", () => {
  it("令和7年を2025年に変換する", () => {
    expect(parseYearFromHeading("令和7年")).toBe(2025);
  });

  it("令和元年を2019年に変換する", () => {
    expect(parseYearFromHeading("令和元年")).toBe(2019);
  });

  it("平成31年を2019年に変換する", () => {
    expect(parseYearFromHeading("平成31年")).toBe(2019);
  });

  it("平成20年を2008年に変換する", () => {
    expect(parseYearFromHeading("平成20年")).toBe(2008);
  });

  it("全角数字を含む見出しを変換する", () => {
    expect(parseYearFromHeading("令和７年")).toBe(2025);
  });

  it("年号がない場合は null を返す", () => {
    expect(parseYearFromHeading("会議録一覧")).toBeNull();
  });
});

describe("parseSessionLabel", () => {
  it("定例会の会次を抽出する", () => {
    const result = parseSessionLabel("第1回定例会");
    expect(result).toEqual({ session: 1, type: "定例会" });
  });

  it("臨時会の会次を抽出する", () => {
    const result = parseSessionLabel("第2回臨時会");
    expect(result).toEqual({ session: 2, type: "臨時会" });
  });

  it("全角数字を含む場合も抽出する", () => {
    const result = parseSessionLabel("第３回定例会");
    expect(result).toEqual({ session: 3, type: "定例会" });
  });

  it("会次が含まれない場合は null を返す", () => {
    expect(parseSessionLabel("令和7年")).toBeNull();
    expect(parseSessionLabel("")).toBeNull();
  });
});

describe("parseDayNumber", () => {
  it("1日目を1に変換する", () => {
    expect(parseDayNumber("1日目", 0)).toBe(1);
  });

  it("2日目を2に変換する", () => {
    expect(parseDayNumber("2日目", 1)).toBe(2);
  });

  it("全角数字を含む場合も変換する", () => {
    expect(parseDayNumber("３日目", 2)).toBe(3);
  });

  it("日目テキストがない場合はcolIndexから計算する", () => {
    expect(parseDayNumber("", 0)).toBe(1);
    expect(parseDayNumber("不明", 2)).toBe(3);
  });
});

describe("parseListPage", () => {
  it("指定年の定例会PDFリンクを抽出する", () => {
    const html = `
      <h4>令和7年</h4>
      <table>
        <tr><th>会議</th><th>1日目</th><th>2日目</th></tr>
        <tr>
          <td>第1回定例会</td>
          <td><a href="/index.cfm/24,11423,c,html/11423/20250301-120000.pdf">[ 500 KB pdf]</a></td>
          <td><a href="/index.cfm/24,11423,c,html/11423/20250302-120000.pdf">[ 600 KB pdf]</a></td>
        </tr>
      </table>
    `;

    const result = parseListPage(html, 2025);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("2025年第1回定例会1日目");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.misawa.lg.jp/index.cfm/24,11423,c,html/11423/20250301-120000.pdf"
    );
    expect(result[0]!.heldOn).toBe("2025-03-01");
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.session).toBe(1);
    expect(result[0]!.dayNumber).toBe(1);

    expect(result[1]!.title).toBe("2025年第1回定例会2日目");
    expect(result[1]!.dayNumber).toBe(2);
  });

  it("臨時会を extraordinary として抽出する", () => {
    const html = `
      <h4>令和7年</h4>
      <table>
        <tr><th>会議</th><th>1日目</th></tr>
        <tr>
          <td>第1回臨時会</td>
          <td><a href="/index.cfm/24,11423,c,html/11423/20250510-093000.pdf">[ 200 KB pdf]</a></td>
        </tr>
      </table>
    `;

    const result = parseListPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("2025年第1回臨時会1日目");
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("指定年以外のセッションはスキップする", () => {
    const html = `
      <h4>令和7年</h4>
      <table>
        <tr><th>会議</th><th>1日目</th></tr>
        <tr>
          <td>第1回定例会</td>
          <td><a href="/index.cfm/24,11423,c,html/11423/20250301-120000.pdf">[ 500 KB pdf]</a></td>
        </tr>
      </table>
      <h4>令和6年</h4>
      <table>
        <tr><th>会議</th><th>1日目</th></tr>
        <tr>
          <td>第1回定例会</td>
          <td><a href="/index.cfm/24,11423,c,html/11423/20240301-120000.pdf">[ 500 KB pdf]</a></td>
        </tr>
      </table>
    `;

    const result = parseListPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
  });

  it("PDFリンクがないセルはスキップする", () => {
    const html = `
      <h4>令和7年</h4>
      <table>
        <tr><th>会議</th><th>1日目</th><th>2日目</th></tr>
        <tr>
          <td>第1回定例会</td>
          <td><a href="/index.cfm/24,11423,c,html/11423/20250301-120000.pdf">[ 500 KB pdf]</a></td>
          <td>（なし）</td>
        </tr>
      </table>
    `;

    const result = parseListPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.dayNumber).toBe(1);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(parseListPage(html, 2025)).toEqual([]);
  });

  it("平成期の会議録を抽出する", () => {
    const html = `
      <h4>平成20年</h4>
      <table>
        <tr><th>会議</th><th>1日目</th></tr>
        <tr>
          <td>第1回定例会</td>
          <td><a href="/index.cfm/24,11423,c,html/11423/H20.1.1.pdf">[ 300 KB pdf]</a></td>
        </tr>
      </table>
    `;

    const result = parseListPage(html, 2008);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("2008年第1回定例会1日目");
    expect(result[0]!.year).toBe(2008);
  });

  it("令和元年のセッションを2019年として抽出する", () => {
    const html = `
      <h4>令和元年</h4>
      <table>
        <tr><th>会議</th><th>1日目</th></tr>
        <tr>
          <td>第1回定例会</td>
          <td><a href="/index.cfm/24,11423,c,html/11423/20190301-120000.pdf">[ 400 KB pdf]</a></td>
        </tr>
      </table>
    `;

    const result = parseListPage(html, 2019);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2019);
  });
});
