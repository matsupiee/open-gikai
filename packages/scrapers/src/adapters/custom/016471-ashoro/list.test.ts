import { describe, it, expect } from "vitest";
import { parseListPage, buildDate } from "./list";

describe("buildDate", () => {
  it("令和の年号と日付テキストから YYYY-MM-DD を返す", () => {
    expect(buildDate("令和7年", "3月4日")).toBe("2025-03-04");
  });

  it("全角数字の年号に対応する", () => {
    expect(buildDate("令和７年", "3月4日")).toBe("2025-03-04");
  });

  it("平成の年号と日付テキストから YYYY-MM-DD を返す", () => {
    expect(buildDate("平成29年", "9月14日")).toBe("2017-09-14");
  });

  it("1桁の月日をゼロ埋めする", () => {
    expect(buildDate("令和6年", "1月24日")).toBe("2024-01-24");
  });

  it("月日の間にスペースがあっても対応する", () => {
    expect(buildDate("令和６年", "3月 5日")).toBe("2024-03-05");
  });

  it("令和元年を正しく変換する", () => {
    expect(buildDate("令和元年", "5月1日")).toBe("2019-05-01");
  });

  it("平成元年を正しく変換する", () => {
    expect(buildDate("平成元年", "1月8日")).toBe("1989-01-08");
  });

  it("年号が不正な場合は null を返す", () => {
    expect(buildDate("不明な年", "3月4日")).toBeNull();
  });

  it("日付テキストが不正な場合は null を返す", () => {
    expect(buildDate("令和7年", "資料")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("table 構造から PDF リンクを正しく抽出する", () => {
    const html = `
      <h2>令和７年</h2>
      <table>
        <tr>
          <td>名称</td>
          <td>開催日</td>
        </tr>
        <tr>
          <td>第１回臨時会</td>
          <td><h4>・<a href="/gikai/assets/r7r1kaigiroku1.24.pdf">1月24日</a></h4></td>
        </tr>
        <tr>
          <td>第１回定例会</td>
          <td>
            <p><strong>・<a href="/gikai/assets/r7t1kaigiroku3.4.pdf">3月4日</a></strong></p>
            <p><strong>・<a href="/gikai/assets/r7t1kaigiroku3.13.pdf">3月13日</a></strong></p>
          </td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.title).toBe("第１回臨時会 1月24日");
    expect(meetings[0]!.heldOn).toBe("2025-01-24");
    expect(meetings[0]!.category).toBe("第１回臨時会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ashoro.hokkaido.jp/gikai/assets/r7r1kaigiroku1.24.pdf",
    );

    expect(meetings[1]!.title).toBe("第１回定例会 3月4日");
    expect(meetings[1]!.heldOn).toBe("2025-03-04");
    expect(meetings[1]!.category).toBe("第１回定例会");

    expect(meetings[2]!.title).toBe("第１回定例会 3月13日");
    expect(meetings[2]!.heldOn).toBe("2025-03-13");
  });

  it("複数年度のデータを正しくパースする", () => {
    const html = `
      <h2>令和７年</h2>
      <table>
        <tr><td>名称</td><td>開催日</td></tr>
        <tr>
          <td>第１回臨時会</td>
          <td><h4>・<a href="/gikai/assets/r7r1kaigiroku1.24.pdf">1月24日</a></h4></td>
        </tr>
      </table>
      <h2>令和６年</h2>
      <table>
        <tr><td>名称</td><td>開催日</td></tr>
        <tr>
          <td>第４回定例会</td>
          <td><h4>・<a href="/gikai/assets/r6t4kaigiroku12.10.pdf">12月10日</a></h4></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-01-24");
    expect(meetings[1]!.heldOn).toBe("2024-12-10");
  });

  it("予算審査特別委員会を正しくパースする", () => {
    const html = `
      <h2>令和７年</h2>
      <table>
        <tr><td>名称</td><td>開催日</td></tr>
        <tr>
          <td>予算審査特別委員会</td>
          <td><p><strong>・<a href="/gikai/assets/r7yosan3.17.pdf">3月17日</a></strong></p></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("予算審査特別委員会");
    expect(meetings[0]!.title).toBe("予算審査特別委員会 3月17日");
  });

  it("平成29年のデータを正しくパースする", () => {
    const html = `
      <h2>平成29年</h2>
      <table>
        <tr><td>名称</td><td>開催日</td></tr>
        <tr>
          <td>第1回定例会</td>
          <td><h4>・<a href="/gikai/assets/29t1kaigiroku3.2.pdf">3月2日</a></h4></td>
        </tr>
        <tr>
          <td>決算審査特別委員会</td>
          <td><h4>・<a href="/gikai/assets/29kessan9.14.pdf">9月14日</a></h4></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2017-03-02");
    expect(meetings[1]!.category).toBe("決算審査特別委員会");
    expect(meetings[1]!.heldOn).toBe("2017-09-14");
  });

  it("平成31年・令和元年の見出しを正しくパースする", () => {
    const html = `
      <h2>平成31年・令和元年</h2>
      <table>
        <tr><td>名称</td><td>開催日</td></tr>
        <tr>
          <td>第１回定例会</td>
          <td><h4>・<a href="/gikai/assets/31t1kaigiroku3.4.pdf">3月4日</a></h4></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-03-04");
  });

  it("日付でないリンクテキストはスキップする", () => {
    const html = `
      <h2>令和７年</h2>
      <table>
        <tr><td>名称</td><td>開催日</td></tr>
        <tr>
          <td>第１回定例会</td>
          <td>
            <a href="/gikai/assets/r7t1kaigiroku3.4.pdf">3月4日</a>
            <a href="/gikai/assets/some-doc.pdf">資料一覧</a>
          </td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("ヘッダー行（名称/開催日）はスキップする", () => {
    const html = `
      <h2>令和７年</h2>
      <table>
        <tr>
          <td>名称</td>
          <td>開催日</td>
        </tr>
        <tr>
          <td>第１回定例会</td>
          <td><a href="/gikai/assets/r7t1kaigiroku3.4.pdf">3月4日</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("第１回定例会");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("")).toEqual([]);
  });
});
