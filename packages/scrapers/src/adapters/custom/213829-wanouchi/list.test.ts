import { describe, it, expect } from "vitest";
import { parseYearPage } from "./list";

describe("parseYearPage", () => {
  it("gikai*.pdf リンクを正しく抽出する", () => {
    const html = `
      <div class="entry-content">
        <ul>
          <li><a href="https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250303.pdf">令和7年第1回定例会（3月）</a></li>
          <li><a href="https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250612.pdf">令和7年第2回定例会（6月）</a></li>
          <li><a href="https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250901.pdf">令和7年第3回定例会（9月）</a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250303.pdf"
    );
    expect(meetings[0]!.fileCode).toBe("250303");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250612.pdf"
    );
    expect(meetings[1]!.fileCode).toBe("250612");

    expect(meetings[2]!.fileCode).toBe("250901");
  });

  it("相対パスの href にも対応する", () => {
    const html = `
      <a href="/wp-content/uploads/gikai260120.pdf">令和8年第1回臨時会</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://town.wanouchi.gifu.jp/wp-content/uploads/gikai260120.pdf"
    );
    expect(meetings[0]!.fileCode).toBe("260120");
  });

  it("wp-content/uploads 以外の PDF リンクはスキップする", () => {
    const html = `
      <a href="/other/document.pdf">その他資料</a>
      <a href="https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250303.pdf">会議録</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.fileCode).toBe("250303");
  });

  it("同じ fileCode の重複リンクは1件のみ返す", () => {
    const html = `
      <a href="https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250303.pdf">会議録1</a>
      <a href="https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250303.pdf">会議録1（再掲）</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("空の HTML では空配列を返す", () => {
    expect(parseYearPage("")).toEqual([]);
  });

  it("gikai パターン以外の wp-content PDF はスキップする", () => {
    const html = `
      <a href="https://town.wanouchi.gifu.jp/wp-content/uploads/other_document.pdf">別資料</a>
      <a href="https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250303.pdf">会議録</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.fileCode).toBe("250303");
  });
});
