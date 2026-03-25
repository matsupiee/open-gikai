import { describe, expect, it } from "vitest";
import { eraCodeToYear, parseHeldOn } from "./shared";
import { parseTopPage, parseYearPage } from "./list";

describe("eraCodeToYear", () => {
  it("h24 → 2012", () => {
    expect(eraCodeToYear("h24")).toBe(2012);
  });

  it("h31 → 2019", () => {
    expect(eraCodeToYear("h31")).toBe(2019);
  });

  it("r01 → 2019", () => {
    expect(eraCodeToYear("r01")).toBe(2019);
  });

  it("r06 → 2024", () => {
    expect(eraCodeToYear("r06")).toBe(2024);
  });

  it("r07 → 2025", () => {
    expect(eraCodeToYear("r07")).toBe(2025);
  });

  it("大文字 H25 → 2013", () => {
    expect(eraCodeToYear("H25")).toBe(2013);
  });

  it("大文字 R02 → 2020", () => {
    expect(eraCodeToYear("R02")).toBe(2020);
  });

  it("不明なコードは null", () => {
    expect(eraCodeToYear("x01")).toBeNull();
  });
});

describe("parseHeldOn", () => {
  it("令和6年3月4日 → 2024-03-04", () => {
    expect(parseHeldOn("令和6年3月4日")).toBe("2024-03-04");
  });

  it("令和元年6月3日 → 2019-06-03", () => {
    expect(parseHeldOn("令和元年6月3日")).toBe("2019-06-03");
  });

  it("平成30年6月1日 → 2018-06-01", () => {
    expect(parseHeldOn("平成30年6月1日")).toBe("2018-06-01");
  });

  it("日付パターンがない場合は null", () => {
    expect(parseHeldOn("会議録")).toBeNull();
  });
});

describe("parseTopPage", () => {
  it("年度別リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/chosei/gikai/kaigiroku/r07/">令和7年</a></li>
        <li><a href="/chosei/gikai/kaigiroku/r06/">令和6年</a></li>
        <li><a href="/chosei/gikai/kaigiroku/r05/">令和5年</a></li>
        <li><a href="/chosei/gikai/kaigiroku/h24/">平成24年</a></li>
      </ul>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(4);
    expect(result[0]!.eraCode).toBe("r07");
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.url).toBe(
      "https://www.town.shiriuchi.hokkaido.jp/chosei/gikai/kaigiroku/r07/",
    );
    expect(result[1]!.year).toBe(2024);
    expect(result[3]!.eraCode).toBe("h24");
    expect(result[3]!.year).toBe(2012);
  });

  it("重複するリンクは除外する", () => {
    const html = `
      <a href="/chosei/gikai/kaigiroku/r06/">令和6年</a>
      <a href="/chosei/gikai/kaigiroku/r06/">令和6年（再掲）</a>
    `;

    const result = parseTopPage(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseTopPage(html)).toEqual([]);
  });
});

describe("parseYearPage", () => {
  it("テーブルから PDF リンクと開催日を抽出する", () => {
    const html = `
      <h3>第1回定例会</h3>
      <table>
        <tr>
          <th>開会日</th><th>区分</th><th>会議録</th>
        </tr>
        <tr>
          <td>令和6年3月4日</td>
          <td>1日目</td>
          <td><a href="/files/00007700/00007787/20240304132320.pdf">会議録</a></td>
        </tr>
      </table>
    `;

    const result = parseYearPage(html);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.pdfUrl).toContain("20240304132320.pdf");
    expect(result[0]!.heldOn).toBe("2024-03-04");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h3>第1回定例会</h3>
      <table>
        <tr><td>令和6年3月4日</td><td>予定</td></tr>
      </table>
    `;

    const result = parseYearPage(html);
    expect(result).toHaveLength(0);
  });

  it("複数の会議種別のテーブルを処理する", () => {
    const html = `
      <h3>定例会</h3>
      <table>
        <tr>
          <td>令和6年3月4日</td>
          <td><a href="/files/00007700/00007787/20240304.pdf">会議録</a></td>
        </tr>
      </table>
      <h3>臨時会</h3>
      <table>
        <tr>
          <td>令和6年5月1日</td>
          <td><a href="/files/00007700/00007787/20240501.pdf">会議録</a></td>
        </tr>
      </table>
    `;

    const result = parseYearPage(html);
    expect(result.length).toBeGreaterThanOrEqual(2);

    const urls = result.map((r) => r.pdfUrl);
    expect(urls.some((u) => u.includes("20240304"))).toBe(true);
    expect(urls.some((u) => u.includes("20240501"))).toBe(true);
  });
});
