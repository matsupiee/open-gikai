import { describe, expect, it } from "vitest";
import { parseYearPage } from "./list";

describe("parseYearPage", () => {
  it("PDF リンクとメタ情報を抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li>
            <a href="/uploaded/attachment/12345.pdf">第1回定例会会議録</a>
          </li>
          <li>
            <a href="/uploaded/attachment/12346.pdf">第2回定例会会議録</a>
          </li>
          <li>
            <a href="/uploaded/attachment/12347.pdf">第1回臨時会会議録</a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseYearPage(html, 2025);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.yamagata.gifu.jp/uploaded/attachment/12345.pdf",
    );
    expect(meetings[0]!.title).toBe("第1回定例会");
    expect(meetings[0]!.fiscalYear).toBe(2025);

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.city.yamagata.gifu.jp/uploaded/attachment/12346.pdf",
    );
    expect(meetings[1]!.title).toBe("第2回定例会");

    expect(meetings[2]!.pdfUrl).toBe(
      "https://www.city.yamagata.gifu.jp/uploaded/attachment/12347.pdf",
    );
    expect(meetings[2]!.title).toBe("第1回臨時会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(0);
  });

  it("/uploaded/attachment/ 以外のリンクは無視する", () => {
    const html = `
      <html>
      <body>
        <a href="/site/gikai/list59.html">会議録一覧</a>
        <a href="/uploaded/attachment/99999.pdf">第3回定例会会議録</a>
        <a href="/other/file.pdf">関係ないPDF</a>
      </body>
      </html>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.yamagata.gifu.jp/uploaded/attachment/99999.pdf",
    );
  });

  it("リンクテキストから会議タイトルを正しく抽出する", () => {
    const html = `
      <html>
      <body>
        <a href="/uploaded/attachment/11111.pdf">令和6年第4回定例会会議録（PDF形式）</a>
        <a href="/uploaded/attachment/11112.pdf">第2回臨時会</a>
      </body>
      </html>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("第4回定例会");
    expect(meetings[1]!.title).toBe("第2回臨時会");
  });

  it("テキストに会議名パターンがない場合はリンクテキスト全体を使用する", () => {
    const html = `
      <html>
      <body>
        <a href="/uploaded/attachment/22222.pdf">会議録資料</a>
      </body>
      </html>
    `;

    const meetings = parseYearPage(html, 2023);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("会議録資料");
  });
});
