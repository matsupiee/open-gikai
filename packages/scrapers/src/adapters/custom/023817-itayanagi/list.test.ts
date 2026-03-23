import { describe, expect, it } from "vitest";
import { extractHeldOnFromTitle, parseYearPage, getYearPageFilenames } from "./list";
import { parseIndexPage } from "./shared";

describe("parseIndexPage", () => {
  it("honkaigi_R* と 2020-0312 のファイル名を収集する", () => {
    const html = `
      <html><body>
      <a href="honkaigi_R7.html#r7dai8kaiteirei">第8回定例会</a>
      <a href="honkaigi_R7.html#r7dai7kaiteirei">第7回定例会</a>
      <a href="honkaigi_R6.html#r6dai4kaiteirei">第4回定例会</a>
      <a href="2020-0312-1647-18.html#anchor">令和2年</a>
      <a href="honkaigi_H31.html#h31dai1kaiteirei">平成31年</a>
      <a href="other-page.html">その他</a>
      </body></html>
    `;

    const filenames = parseIndexPage(html);

    expect(filenames).toContain("honkaigi_R7.html");
    expect(filenames).toContain("honkaigi_R6.html");
    expect(filenames).toContain("2020-0312-1647-18.html");
    expect(filenames).toContain("honkaigi_H31.html");
    expect(filenames).not.toContain("other-page.html");
  });

  it("アンカーを除いてファイル名の重複を排除する", () => {
    const html = `
      <html><body>
      <a href="honkaigi_R7.html#r7dai8kaiteirei">第8回定例会</a>
      <a href="honkaigi_R7.html#r7dai7kaiteirei">第7回定例会</a>
      </body></html>
    `;

    const filenames = parseIndexPage(html);
    expect(filenames.filter((f) => f === "honkaigi_R7.html")).toHaveLength(1);
  });
});

describe("extractHeldOnFromTitle", () => {
  it("定例会の日付範囲から初日を抽出する", () => {
    const result = extractHeldOnFromTitle("第4回定例会（令和６年12月２日～６日）");
    expect(result).toBe("2024-12-02");
  });

  it("臨時会の単日を抽出する", () => {
    const result = extractHeldOnFromTitle("第1回臨時会（令和６年３月11日）");
    expect(result).toBe("2024-03-11");
  });

  it("令和7年の日付を正しく変換する", () => {
    const result = extractHeldOnFromTitle("第8回定例会（令和７年12月５日～11日）");
    expect(result).toBe("2025-12-05");
  });

  it("平成年号を正しく変換する", () => {
    const result = extractHeldOnFromTitle("第1回定例会（平成30年3月15日～25日）");
    expect(result).toBe("2018-03-15");
  });

  it("括弧がない場合は null を返す", () => {
    const result = extractHeldOnFromTitle("定例会・臨時会　令和６年");
    expect(result).toBeNull();
  });

  it("日付が含まれない場合は null を返す", () => {
    const result = extractHeldOnFromTitle("第1回定例会（議案なし）");
    expect(result).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("h2見出しから会議一覧を抽出する", () => {
    const html = `
      <html><body>
      <h2>定例会・臨時会　令和６年</h2>
      <h2>第4回定例会（令和６年12月２日～６日）</h2>
      <table>
        <tr><th>議案番号</th><th>提出年月日</th><th>件名</th><th>議決結果</th></tr>
        <tr><td>議案第1号</td><td>令和6年12月2日</td><td>テスト議案</td><td>原案可決</td></tr>
      </table>
      <h2>第3回定例会（令和６年９月６日～13日）</h2>
      <h2>第1回臨時会（令和６年３月11日）</h2>
      </body></html>
    `;

    const meetings = parseYearPage(html, "https://example.com/honkaigi_R6.html");

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.title).toBe("第4回定例会（令和６年12月２日～６日）");
    expect(meetings[0]!.heldOn).toBe("2024-12-02");
    expect(meetings[0]!.pageUrl).toBe("https://example.com/honkaigi_R6.html");
    expect(meetings[0]!.sectionIndex).toBe(0);
    expect(meetings[1]!.title).toBe("第3回定例会（令和６年９月６日～13日）");
    expect(meetings[1]!.sectionIndex).toBe(1);
    expect(meetings[2]!.title).toBe("第1回臨時会（令和６年３月11日）");
    expect(meetings[2]!.sectionIndex).toBe(2);
  });

  it("「定例会」「臨時会」を含まない h2 はスキップする", () => {
    const html = `
      <html><body>
      <h2>定例会・臨時会　令和６年</h2>
      <h2>お知らせ</h2>
      <h2>第1回定例会（令和６年３月15日～25日）</h2>
      </body></html>
    `;

    const meetings = parseYearPage(html, "https://example.com/honkaigi_R6.html");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第1回定例会（令和６年３月15日～25日）");
  });

  it("日付が解析できない h2 はスキップする", () => {
    const html = `
      <html><body>
      <h2>定例会・臨時会　令和６年</h2>
      <h2>第1回定例会</h2>
      <h2>第2回定例会（令和６年６月３日～７日）</h2>
      </body></html>
    `;

    const meetings = parseYearPage(html, "https://example.com/honkaigi_R6.html");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第2回定例会（令和６年６月３日～７日）");
  });
});

describe("getYearPageFilenames", () => {
  it("令和6年(2024)は honkaigi_R6.html と honkaigi_R5.html を含む", () => {
    const filenames = getYearPageFilenames(2024);
    expect(filenames).toContain("honkaigi_R6.html");
    expect(filenames).toContain("honkaigi_R5.html");
  });

  it("令和2年(2020)は 2020-0312-1647-18.html を含む", () => {
    const filenames = getYearPageFilenames(2020);
    expect(filenames).toContain("2020-0312-1647-18.html");
  });

  it("平成31年(2019)は honkaigi_H31.html を含む", () => {
    const filenames = getYearPageFilenames(2019);
    expect(filenames).toContain("honkaigi_H31.html");
  });

  it("平成30年(2018)は honkaigi_H30.html を含む", () => {
    const filenames = getYearPageFilenames(2018);
    expect(filenames).toContain("honkaigi_H30.html");
  });
});
