import { describe, it, expect } from "vitest";
import { parseListPage, buildEraTitle } from "./list";
import {
  parseYearFromHeader,
  parseSessionFromCell,
  extractYearFromTitle,
  eraToWestern,
} from "./shared";

describe("parseYearFromHeader", () => {
  it("令和6年を正しく変換する", () => {
    expect(parseYearFromHeader("令和6年")).toBe(2024);
  });

  it("令和元年を正しく変換する", () => {
    expect(parseYearFromHeader("令和元年")).toBe(2019);
  });

  it("平成27年を正しく変換する", () => {
    expect(parseYearFromHeader("平成27年")).toBe(2015);
  });

  it("令和元年（R1/2019年）形式を変換する", () => {
    expect(parseYearFromHeader("令和元年（R1/2019年）")).toBe(2019);
  });

  it("全角数字を含む年を変換する", () => {
    expect(parseYearFromHeader("令和６年")).toBe(2024);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(parseYearFromHeader("回次")).toBeNull();
  });

  it("空文字は null を返す", () => {
    expect(parseYearFromHeader("")).toBeNull();
  });
});

describe("parseSessionFromCell", () => {
  it("3月定例会を正しくパースする", () => {
    const result = parseSessionFromCell("3月定例会");
    expect(result).not.toBeNull();
    expect(result!.month).toBe(3);
    expect(result!.sessionType).toBe("定例会");
  });

  it("11月臨時会を正しくパースする", () => {
    const result = parseSessionFromCell("11月臨時会");
    expect(result).not.toBeNull();
    expect(result!.month).toBe(11);
    expect(result!.sessionType).toBe("臨時会");
  });

  it("全角数字の月もパースする", () => {
    const result = parseSessionFromCell("６月定例会");
    expect(result).not.toBeNull();
    expect(result!.month).toBe(6);
    expect(result!.sessionType).toBe("定例会");
  });

  it("種別が含まれない場合は null を返す", () => {
    expect(parseSessionFromCell("第1回")).toBeNull();
  });

  it("空文字は null を返す", () => {
    expect(parseSessionFromCell("")).toBeNull();
  });
});

describe("eraToWestern", () => {
  it("令和6年を2024に変換する", () => {
    expect(eraToWestern("令和", "6")).toBe(2024);
  });

  it("令和元年を2019に変換する", () => {
    expect(eraToWestern("令和", "元")).toBe(2019);
  });

  it("平成30年を2018に変換する", () => {
    expect(eraToWestern("平成", "30")).toBe(2018);
  });

  it("平成元年を1989に変換する", () => {
    expect(eraToWestern("平成", "元")).toBe(1989);
  });
});

describe("extractYearFromTitle", () => {
  it("令和6年第2回定例会議事録から年を抽出する", () => {
    expect(extractYearFromTitle("令和6年第2回定例会議事録")).toBe(2024);
  });

  it("令和元年第3回定例会から年を抽出する", () => {
    expect(extractYearFromTitle("令和元年第3回定例会")).toBe(2019);
  });

  it("平成30年第1回定例会から年を抽出する", () => {
    expect(extractYearFromTitle("平成30年第1回定例会")).toBe(2018);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("第1回定例会")).toBeNull();
  });
});

describe("buildEraTitle", () => {
  it("2024年を令和6年に変換する", () => {
    expect(buildEraTitle(2024)).toBe("令和6年");
  });

  it("2019年を令和元年に変換する", () => {
    expect(buildEraTitle(2019)).toBe("令和元年");
  });

  it("2020年を令和2年に変換する", () => {
    expect(buildEraTitle(2020)).toBe("令和2年");
  });

  it("2018年を平成30年に変換する", () => {
    expect(buildEraTitle(2018)).toBe("平成30年");
  });

  it("2015年を平成27年に変換する", () => {
    expect(buildEraTitle(2015)).toBe("平成27年");
  });
});

describe("parseListPage", () => {
  it("テーブルから PDF リンクとメタ情報を抽出する", () => {
    const html = `
      <table>
        <tr>
          <th>回次</th>
          <th>令和6年</th>
          <th>令和5年</th>
        </tr>
        <tr>
          <td>第1回</td>
          <td>3月定例会<br><a href="/wp-content/uploads/2024/03/令和6年第1回定例会議事録.pdf">PDF</a></td>
          <td>3月定例会<br><a href="/wp-content/uploads/2023/03/令和5年第1回定例会議事録.pdf">PDF</a></td>
        </tr>
        <tr>
          <td>第2回</td>
          <td>6月定例会<br><a href="/wp-content/uploads/2024/06/令和6年第2回定例会議事録.pdf">PDF</a></td>
          <td></td>
        </tr>
      </table>
    `;

    const results = parseListPage(html);

    expect(results.length).toBe(3);

    expect(results[0]!.year).toBe(2024);
    expect(results[0]!.month).toBe(3);
    expect(results[0]!.sessionType).toBe("定例会");
    expect(results[0]!.title).toBe("令和6年（3月）定例会");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.yokoze.saitama.jp/wp-content/uploads/2024/03/令和6年第1回定例会議事録.pdf",
    );
    expect(results[0]!.heldOn).toBe("2024-03-01");

    expect(results[1]!.year).toBe(2023);
    expect(results[1]!.month).toBe(3);

    expect(results[2]!.year).toBe(2024);
    expect(results[2]!.month).toBe(6);
  });

  it("絶対 URL の PDF リンクもそのまま返す", () => {
    const html = `
      <table>
        <tr>
          <th>令和7年</th>
        </tr>
        <tr>
          <td>6月定例会<br><a href="https://www.town.yokoze.saitama.jp/wp-content/uploads/2025/06/test.pdf">PDF</a></td>
        </tr>
      </table>
    `;

    const results = parseListPage(html);
    expect(results.length).toBe(1);
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.yokoze.saitama.jp/wp-content/uploads/2025/06/test.pdf",
    );
  });

  it("PDF リンクがないセルはスキップする", () => {
    const html = `
      <table>
        <tr>
          <th>令和6年</th>
        </tr>
        <tr>
          <td>3月定例会</td>
        </tr>
      </table>
    `;

    const results = parseListPage(html);
    expect(results.length).toBe(0);
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <table>
        <tr>
          <th>令和6年</th>
        </tr>
        <tr>
          <td>3月定例会<br><a href="/wp-content/uploads/2024/03/test.pdf">PDF</a></td>
        </tr>
      </table>
      <table>
        <tr>
          <th>令和6年</th>
        </tr>
        <tr>
          <td>3月定例会<br><a href="/wp-content/uploads/2024/03/test.pdf">PDF</a></td>
        </tr>
      </table>
    `;

    const results = parseListPage(html);
    expect(results.length).toBe(1);
  });

  it("テーブルがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    expect(parseListPage(html)).toHaveLength(0);
  });

  it("令和元年も正しくパースする", () => {
    const html = `
      <table>
        <tr>
          <th>令和元年</th>
        </tr>
        <tr>
          <td>9月定例会<br><a href="/wp-content/uploads/2019/09/R1_3rd.pdf">PDF</a></td>
        </tr>
      </table>
    `;

    const results = parseListPage(html);
    expect(results.length).toBe(1);
    expect(results[0]!.year).toBe(2019);
    expect(results[0]!.title).toBe("令和元年（9月）定例会");
  });

  it("臨時会も正しくパースする", () => {
    const html = `
      <table>
        <tr>
          <th>令和6年</th>
        </tr>
        <tr>
          <td>11月臨時会<br><a href="/wp-content/uploads/2024/11/R6_extra.pdf">PDF</a></td>
        </tr>
      </table>
    `;

    const results = parseListPage(html);
    expect(results.length).toBe(1);
    expect(results[0]!.sessionType).toBe("臨時会");
    expect(results[0]!.title).toBe("令和6年（11月）臨時会");
  });
});
