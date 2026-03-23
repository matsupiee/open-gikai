import { describe, it, expect } from "vitest";
import { parseListPage, buildDate } from "./list";

describe("buildDate", () => {
  it("令和の年号と日付テキストから YYYY-MM-DD を返す", () => {
    expect(buildDate("令和7年", "12月9日開催　PDFファイル　779KB")).toBe("2025-12-09");
  });

  it("全角数字の年号と日付に対応する", () => {
    expect(buildDate("令和７年", "１２月９日開催　PDFファイル　779KB")).toBe("2025-12-09");
  });

  it("平成の年号と日付テキストから YYYY-MM-DD を返す", () => {
    expect(buildDate("平成28年", "12月6日開催　PDFファイル　319KB")).toBe("2016-12-06");
  });

  it("全角数字の平成の年号に対応する", () => {
    expect(buildDate("平成２８年", "１２月６日開催　PDFファイル　319KB")).toBe("2016-12-06");
  });

  it("1桁の月日をゼロ埋めする", () => {
    expect(buildDate("令和6年", "3月5日開催　PDFファイル　500KB")).toBe("2024-03-05");
  });

  it("令和元年を正しく変換する", () => {
    expect(buildDate("令和元年", "5月1日開催")).toBe("2019-05-01");
  });

  it("年号が不正な場合は null を返す", () => {
    expect(buildDate("不明な年", "3月4日開催")).toBeNull();
  });

  it("日付テキストが不正な場合は null を返す", () => {
    expect(buildDate("令和7年", "資料一覧")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("h3/h5/a 構造から PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>令和７年</h3>
      <h5>第６回定例会</h5>
      <ul>
        <li><a href="../common/img/content/content_20260313_160716.pdf">１２月９日開催　PDFファイル　779KB</a></li>
        <li><a href="../common/img/content/content_20260313_160722.pdf">１２月１０日開催　PDFファイル　559KB</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("第6回定例会 12月9日");
    expect(meetings[0]!.heldOn).toBe("2025-12-09");
    expect(meetings[0]!.category).toBe("第6回定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://engaru.jp/common/img/content/content_20260313_160716.pdf",
    );

    expect(meetings[1]!.title).toBe("第6回定例会 12月10日");
    expect(meetings[1]!.heldOn).toBe("2025-12-10");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://engaru.jp/common/img/content/content_20260313_160722.pdf",
    );
  });

  it("臨時会を正しくパースする", () => {
    const html = `
      <h3>令和７年</h3>
      <h5>第５回臨時会</h5>
      <ul>
        <li><a href="../common/img/content/content_20260129_101052.pdf">１０月２７日開催　PDFファイル　582KB</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("第5回臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-10-27");
  });

  it("複数年度のデータを正しくパースする", () => {
    const html = `
      <h3>令和７年</h3>
      <h5>第６回定例会</h5>
      <ul>
        <li><a href="../common/img/content/content_20260313_160716.pdf">１２月９日開催　PDFファイル　779KB</a></li>
      </ul>
      <h3>令和６年</h3>
      <h5>第８回定例会</h5>
      <ul>
        <li><a href="../common/img/content/content_20250228_135650.pdf">１２月１０日開催　PDFファイル　624KB</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-12-09");
    expect(meetings[1]!.heldOn).toBe("2024-12-10");
  });

  it("平成28年のデータを正しくパースする", () => {
    const html = `
      <h3>平成２８年</h3>
      <h5>第９回定例会</h5>
      <ul>
        <li><a href="../common/img/content/content_20200212_111845.pdf">１２月６日開催　PDFファイル　319KB</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2016-12-06");
    expect(meetings[0]!.category).toBe("第9回定例会");
  });

  it("同一会議種別に複数日のリンクがある場合を正しくパースする", () => {
    const html = `
      <h3>令和７年</h3>
      <h5>第６回定例会</h5>
      <ul>
        <li><a href="../common/img/content/content_20260313_160716.pdf">１２月９日開催　PDFファイル　779KB</a></li>
        <li><a href="../common/img/content/content_20260313_160722.pdf">１２月１０日開催　PDFファイル　559KB</a></li>
        <li><a href="../common/img/content/content_20260313_160728.pdf">１２月１１日開催　PDFファイル　349KB</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2025-12-09");
    expect(meetings[1]!.heldOn).toBe("2025-12-10");
    expect(meetings[2]!.heldOn).toBe("2025-12-11");
  });

  it("日付を含まないリンクテキストはスキップする", () => {
    const html = `
      <h3>令和７年</h3>
      <h5>第１回定例会</h5>
      <ul>
        <li><a href="../common/img/content/content_20260313_160716.pdf">３月５日開催　PDFファイル　500KB</a></li>
        <li><a href="../common/img/content/some-doc.pdf">資料一覧</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("")).toEqual([]);
  });

  it("h3 が無い場合は空配列を返す", () => {
    const html = `
      <h5>第１回定例会</h5>
      <ul>
        <li><a href="../common/img/content/content_20260313_160716.pdf">３月５日開催</a></li>
      </ul>
    `;

    expect(parseListPage(html)).toEqual([]);
  });

  it("h5 が無い場合は空配列を返す", () => {
    const html = `
      <h3>令和７年</h3>
      <ul>
        <li><a href="../common/img/content/content_20260313_160716.pdf">３月５日開催</a></li>
      </ul>
    `;

    expect(parseListPage(html)).toEqual([]);
  });
});
