import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("指定年度の PDF リンクを正しく抽出する", () => {
    const html = `
      <h2>令和6年</h2>
      <ul>
        <li><a href="/uploaded/attachment/3750.pdf">第1回定例会（3月）</a></li>
        <li><a href="/uploaded/attachment/3749.pdf">第2回定例会（6月）</a></li>
        <li><a href="/uploaded/attachment/4025.pdf">第3回定例会（9月）</a></li>
        <li><a href="/uploaded/attachment/4188.pdf">第4回定例会（12月）</a></li>
      </ul>
      <h2>令和5年</h2>
      <ul>
        <li><a href="/uploaded/attachment/2880.pdf">第1回定例会（3月）</a></li>
      </ul>
    `;

    const records = parseListPage(html, 2024);

    expect(records).toHaveLength(4);
    expect(records[0]!.title).toBe("第1回定例会（3月）");
    expect(records[0]!.pdfUrl).toBe("https://www.town.miyake.lg.jp/uploaded/attachment/3750.pdf");
    expect(records[0]!.year).toBe(2024);
    expect(records[0]!.meetingType).toBe("plenary");

    expect(records[3]!.title).toBe("第4回定例会（12月）");
    expect(records[3]!.pdfUrl).toBe("https://www.town.miyake.lg.jp/uploaded/attachment/4188.pdf");
  });

  it("平成年度の PDF リンクを正しく抽出する", () => {
    const html = `
      <h2>平成30年</h2>
      <ul>
        <li><a href="/uploaded/attachment/1293.pdf">第1回定例会（3月）</a></li>
        <li><a href="/uploaded/attachment/1294.pdf">第1回臨時会（4月）</a></li>
      </ul>
    `;

    const records = parseListPage(html, 2018);

    expect(records).toHaveLength(2);
    expect(records[0]!.year).toBe(2018);
    expect(records[1]!.meetingType).toBe("extraordinary");
  });

  it("令和元年を正しく処理する", () => {
    const html = `
      <h2>令和元年</h2>
      <ul>
        <li><a href="/uploaded/attachment/9999.pdf">第1回定例会（3月）</a></li>
      </ul>
    `;

    const records = parseListPage(html, 2019);

    expect(records).toHaveLength(1);
    expect(records[0]!.year).toBe(2019);
  });

  it("臨時議会を extraordinary として検出する", () => {
    const html = `
      <h2>令和5年</h2>
      <ul>
        <li><a href="/uploaded/attachment/2881.pdf">第1回臨時議会</a></li>
      </ul>
    `;

    const records = parseListPage(html, 2023);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("対象年が存在しない場合は空配列を返す", () => {
    const html = `
      <h2>令和6年</h2>
      <ul>
        <li><a href="/uploaded/attachment/3750.pdf">第1回定例会（3月）</a></li>
      </ul>
    `;

    const records = parseListPage(html, 2020);

    expect(records).toHaveLength(0);
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <h2>令和6年</h2>
      <ul>
        <li><a href="/uploaded/attachment/3750.pdf">第1回定例会（3月）</a></li>
        <li><a href="/uploaded/attachment/3750.pdf">第1回定例会（3月）</a></li>
      </ul>
    `;

    const records = parseListPage(html, 2024);

    expect(records).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>令和6年</h2>
      <p>準備中</p>
    `;

    const records = parseListPage(html, 2024);

    expect(records).toHaveLength(0);
  });
});
