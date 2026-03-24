import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseLinkDate, isMinutePdf } from "./list";

describe("isMinutePdf", () => {
  it("目次ファイル (-m.pdf) は除外する", () => {
    expect(isMinutePdf("R06.12-m.pdf")).toBe(false);
    expect(isMinutePdf("H28.3-m.pdf")).toBe(false);
    expect(isMinutePdf("H28.5r-m.pdf")).toBe(false);
  });

  it("審議結果ファイル (-k.pdf) は除外する", () => {
    expect(isMinutePdf("R06.12-k.pdf")).toBe(false);
  });

  it("参考資料ファイル (-s.pdf) は除外する", () => {
    expect(isMinutePdf("R06.12-s.pdf")).toBe(false);
  });

  it("議事録本文ファイル (-1.pdf 等) は対象とする", () => {
    expect(isMinutePdf("R06.12-1.pdf")).toBe(true);
    expect(isMinutePdf("R06.12-2.pdf")).toBe(true);
    expect(isMinutePdf("R06.12-3.pdf")).toBe(true);
  });

  it("H17-H18 形式の議事録ファイル (-g-1.pdf) は対象とする", () => {
    expect(isMinutePdf("17-3g-1.pdf")).toBe(true);
    expect(isMinutePdf("17-3g-2.pdf")).toBe(true);
  });
});

describe("parseLinkDate", () => {
  it("令和6年第2回（3月）定例会をパースする", () => {
    expect(parseLinkDate("令和6年第2回（3月）定例会")).toBe("2024-03-01");
  });

  it("令和6年第1回（2月）臨時会をパースする", () => {
    expect(parseLinkDate("令和6年第1回（2月）臨時会")).toBe("2024-02-01");
  });

  it("全角数字に対応する", () => {
    expect(parseLinkDate("令和６年第２回（３月）定例会")).toBe("2024-03-01");
  });

  it("令和元年に対応する", () => {
    expect(parseLinkDate("令和元年第2回（6月）定例会")).toBe("2019-06-01");
  });

  it("平成17年第3回（12月）定例会をパースする", () => {
    expect(parseLinkDate("平成17年第3回（12月）定例会")).toBe("2005-12-01");
  });

  it("平成31年に対応する", () => {
    expect(parseLinkDate("平成31年第2回（6月）定例会")).toBe("2019-06-01");
  });

  it("12月をパースする", () => {
    expect(parseLinkDate("令和6年第7回（12月）定例会")).toBe("2024-12-01");
  });

  it("日付情報がない場合は null を返す", () => {
    expect(parseLinkDate("目次")).toBeNull();
    expect(parseLinkDate("審議結果")).toBeNull();
    expect(parseLinkDate("")).toBeNull();
  });
});

describe("parseTopPage", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="2024-0327-1106-66.html">令和6年</a></li>
        <li><a href="2023-0414-1000-66.html">令和5年</a></li>
        <li><a href="h30.html">平成30年</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.some((p) => p.year === 2024)).toBe(true);
    expect(pages.some((p) => p.year === 2023)).toBe(true);
    expect(pages.some((p) => p.year === 2018)).toBe(true);
  });

  it("令和元年を正しく処理する", () => {
    const html = `
      <a href="2019-0925-1654-66.html">令和元年</a>
    `;

    const pages = parseTopPage(html);
    expect(pages.some((p) => p.year === 2019)).toBe(true);
  });

  it("重複した URL は除外する", () => {
    const html = `
      <a href="2024-0327-1106-66.html">令和6年議会</a>
      <a href="2024-0327-1106-66.html">令和6年会議録</a>
    `;

    const pages = parseTopPage(html);
    const r6Pages = pages.filter((p) => p.year === 2024);
    expect(r6Pages).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("議事録 PDF リンクを正しく抽出する（実際の HTML 構造）", () => {
    // 実際のみなかみ町サイトの HTML 構造を再現
    const html = `
【みなかみ町令和6年第7回（12月）定例会】<br>
<a href="files/R06.12-m.pdf">・目次</a>　<a href="files/R06.12-1.pdf">・議事録-1</a>　<a href="files/R06.12-2.pdf">・議事録-2</a>　<a href="files/R06.12-3.pdf">・議事録-3</a>　<a href="files/R06.12-k.pdf">・審議結果</a>　<a href="files/R06.12-s.pdf">・参考資料</a><br>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toContain("R06.12-1.pdf");
    expect(meetings[1]!.pdfUrl).toContain("R06.12-2.pdf");
    expect(meetings[2]!.pdfUrl).toContain("R06.12-3.pdf");
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
    expect(meetings[0]!.title).toContain("令和6年第7回（12月）定例会");
  });

  it("同じ href の重複リンク（bullet + text）を除去する", () => {
    // bullet の <a> とテキストの <a> が同じ href で2回出現するパターン
    const html = `
【みなかみ町令和6年第1回（2月）臨時会】<br>
<a href="files/R06-2-m.pdf">・</a><a href="files/R06-2-m.pdf">目次</a>　<a href="files/R06-2-1.pdf">・</a><a href="files/R06-2-1.pdf">議事録-1</a>　<a href="files/R06-2-k.pdf">・審議結果</a><br>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("R06-2-1.pdf");
    expect(meetings[0]!.heldOn).toBe("2024-02-01");
    expect(meetings[0]!.title).toContain("令和6年第1回（2月）臨時会");
  });

  it("複数の会議を正しく抽出する", () => {
    const html = `
【みなかみ町令和6年第5回（9月）定例会】<br>
<a href="files/R06.9-m.pdf">・目次</a>　<a href="files/R06.9-1.pdf">・議事録-1</a>　<a href="files/R06.9-k.pdf">・審議結果</a><br>
<br>
【みなかみ町令和6年第4回（7月）臨時会】<br>
<a href="files/R06.7-m.pdf">・目次</a>　<a href="files/R06.7r-1.pdf">・議事録-1</a>　<a href="files/R06.7-k.pdf">・審議結果</a><br>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-09-01");
    expect(meetings[0]!.pdfUrl).toContain("R06.9-1.pdf");
    expect(meetings[1]!.heldOn).toBe("2024-07-01");
    expect(meetings[1]!.pdfUrl).toContain("R06.7r-1.pdf");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>令和6年</p></div>`;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });
});
