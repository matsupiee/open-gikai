import { describe, expect, it } from "vitest";
import { parseMeetingDate, parseYearlyPage } from "./list";

describe("parseMeetingDate", () => {
  it("令和6年の定例会から開催日をパースする", () => {
    const result = parseMeetingDate(
      "令和6年(2024年)第4回ニセコ町議会定例会",
      "12月19日",
    );
    expect(result).toBe("2024-12-19");
  });

  it("令和6年の臨時会から開催日をパースする", () => {
    const result = parseMeetingDate(
      "令和6年(2024年)第1回ニセコ町議会臨時会",
      "1月22日",
    );
    expect(result).toBe("2024-01-22");
  });

  it("令和5年の定例会から開催日をパースする", () => {
    const result = parseMeetingDate(
      "令和5年(2023年)第3回ニセコ町議会定例会",
      "9月7日",
    );
    expect(result).toBe("2023-09-07");
  });

  it("予算特別委員会から開催日をパースする", () => {
    const result = parseMeetingDate(
      "令和6年度予算特別委員会",
      "3月1日",
    );
    // 予算特別委員会は西暦括弧なしのため和暦から推定
    expect(result).toBe("2024-03-01");
  });

  it("月日がない場合は null を返す", () => {
    const result = parseMeetingDate(
      "令和6年(2024年)第4回ニセコ町議会定例会",
      "会議録",
    );
    expect(result).toBeNull();
  });

  it("年がない場合は null を返す", () => {
    const result = parseMeetingDate("不明な会議タイトル", "12月19日");
    expect(result).toBeNull();
  });
});

describe("parseYearlyPage", () => {
  it("h3 見出しと PDF リンクからミーティング一覧を抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>令和6年(2024年)第4回ニセコ町議会定例会</h3>
        <ul>
          <li>
            <a href="/resources/output/contents/file/release/10778/12345/20241219.pdf">
              12月19日
            </a>
          </li>
        </ul>
        <h3>令和6年(2024年)第1回ニセコ町議会臨時会</h3>
        <ul>
          <li>
            <a href="/resources/output/contents/file/release/10778/11111/20240122.pdf">
              1月22日
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseYearlyPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.niseko.lg.jp/resources/output/contents/file/release/10778/12345/20241219.pdf",
    );
    expect(meetings[0]!.title).toBe("令和6年(2024年)第4回ニセコ町議会定例会");
    expect(meetings[0]!.heldOn).toBe("2024-12-19");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.niseko.lg.jp/resources/output/contents/file/release/10778/11111/20240122.pdf",
    );
    expect(meetings[1]!.title).toBe("令和6年(2024年)第1回ニセコ町議会臨時会");
    expect(meetings[1]!.heldOn).toBe("2024-01-22");
  });

  it("複数の PDF を持つ会議を正しく抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>令和6年(2024年)第3回ニセコ町議会定例会</h3>
        <ul>
          <li>
            <a href="/resources/output/contents/file/release/10778/22222/20240919.pdf">
              9月19日
            </a>
          </li>
          <li>
            <a href="/resources/output/contents/file/release/10778/22223/20240920.pdf">
              9月20日
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseYearlyPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-09-19");
    expect(meetings[1]!.heldOn).toBe("2024-09-20");
    expect(meetings[0]!.title).toBe("令和6年(2024年)第3回ニセコ町議会定例会");
    expect(meetings[1]!.title).toBe("令和6年(2024年)第3回ニセコ町議会定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parseYearlyPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクをそのまま返す", () => {
    const html = `
      <html>
      <body>
        <h3>令和6年(2024年)第1回ニセコ町議会臨時会</h3>
        <ul>
          <li>
            <a href="https://www.town.niseko.lg.jp/resources/output/contents/file/release/10778/99999/20240115.pdf">
              1月15日
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseYearlyPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.niseko.lg.jp/resources/output/contents/file/release/10778/99999/20240115.pdf",
    );
  });
});
