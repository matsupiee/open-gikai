import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("PDF リンクを正しく抽出する", () => {
    const html = `
      <ul>
        <li><a href="pdf/kaigiroku/r6_1.pdf">第1回定例会（3月）</a></li>
        <li><a href="pdf/kaigiroku/r6_2.pdf">第2回臨時会（4月）</a></li>
        <li><a href="pdf/kaigiroku/r6_3.pdf">第3回定例会（6月）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, "r6");

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.godo.gifu.jp/contents/gikai/pdf/kaigiroku/r6_1.pdf"
    );
    expect(meetings[0]!.title).toBe("第1回定例会（3月）");
    expect(meetings[0]!.eraCode).toBe("r6");
    expect(meetings[0]!.number).toBe("1");

    expect(meetings[1]!.title).toBe("第2回臨時会（4月）");
    expect(meetings[1]!.number).toBe("2");

    expect(meetings[2]!.title).toBe("第3回定例会（6月）");
    expect(meetings[2]!.number).toBe("3");
  });

  it("年度コードでフィルタリングする", () => {
    const html = `
      <ul>
        <li><a href="pdf/kaigiroku/r6_1.pdf">第1回定例会（3月）</a></li>
        <li><a href="pdf/kaigiroku/r7_1.pdf">第1回臨時会（1月）</a></li>
        <li><a href="pdf/kaigiroku/r7_2.pdf">第2回定例会（3月）</a></li>
      </ul>
    `;

    const r6 = parseListPage(html, "r6");
    expect(r6).toHaveLength(1);
    expect(r6[0]!.eraCode).toBe("r6");

    const r7 = parseListPage(html, "r7");
    expect(r7).toHaveLength(2);
    expect(r7[0]!.eraCode).toBe("r7");
    expect(r7[1]!.eraCode).toBe("r7");
  });

  it("targetEraCode が null なら全件返す", () => {
    const html = `
      <li><a href="pdf/kaigiroku/r6_1.pdf">第1回定例会（3月）</a></li>
      <li><a href="pdf/kaigiroku/r7_1.pdf">第1回臨時会（1月）</a></li>
    `;

    const all = parseListPage(html, null);
    expect(all).toHaveLength(2);
  });

  it("kaigiroku 以外の PDF リンクはスキップする", () => {
    const html = `
      <a href="pdf/other/document.pdf">資料</a>
      <a href="pdf/kaigiroku/r6_1.pdf">第1回定例会（3月）</a>
    `;

    const meetings = parseListPage(html, null);
    expect(meetings).toHaveLength(1);
  });

  it("絶対パスの href にも対応する", () => {
    const html = `
      <a href="https://www.town.godo.gifu.jp/contents/gikai/pdf/kaigiroku/r7_3.pdf">第3回定例会（6月）</a>
    `;

    const meetings = parseListPage(html, "r7");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.godo.gifu.jp/contents/gikai/pdf/kaigiroku/r7_3.pdf"
    );
  });

  it("空の HTML では空配列を返す", () => {
    expect(parseListPage("", "r6")).toEqual([]);
  });
});
