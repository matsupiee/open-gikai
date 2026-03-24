import { describe, it, expect } from "vitest";
import { parseListPage, parseDetailPage, extractYearFromTitle } from "./list";
import { parseJapaneseDate } from "./shared";

describe("parseListPage", () => {
  it("kiji リンクからエントリを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="https://www.kumamura.com/kiji0035000/index.html">令和６年第８回定例会　会議録</a>
        </li>
        <li>
          <a href="https://www.kumamura.com/kiji0034000/index.html">令和６年第１回臨時会　会議録</a>
        </li>
      </ul>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(2);
    expect(results[0]!.kijiId).toBe("0035000");
    expect(results[0]!.title).toBe("令和６年第８回定例会　会議録");
    expect(results[1]!.kijiId).toBe("0034000");
    expect(results[1]!.title).toBe("令和６年第１回臨時会　会議録");
  });

  it("重複する kijiId は除外する", () => {
    const html = `
      <a href="/kiji0035000/index.html">タイトルA</a>
      <a href="/kiji0035000/index.html">タイトルB</a>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
  });

  it("kiji リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const results = parseListPage(html);
    expect(results).toHaveLength(0);
  });

  it("相対パスの kiji リンクも抽出する", () => {
    const html = `
      <li>
        <a href="/kiji0032000/index.html">令和３年第６回臨時会　会議録</a>
      </li>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.kijiId).toBe("0032000");
  });
});

describe("parseDetailPage", () => {
  it("複数の PDF URL と開催日を抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和６年第８回定例会　会議録</h2>
        <p>令和６年９月９日～１７日</p>
        <a href="/kiji0035000/3_35000_1_abc123.pdf">審議結果</a>
        <a href="/kiji0035000/3_35000_2_def456.pdf">初日会議録</a>
        <a href="/kiji0035000/3_35000_3_ghi789.pdf">2日目会議録</a>
      </body>
      </html>
    `;

    const { pdfUrls, heldOn } = parseDetailPage(html);

    expect(pdfUrls).toHaveLength(3);
    expect(pdfUrls[0]).toBe("https://www.kumamura.com/kiji0035000/3_35000_1_abc123.pdf");
    expect(pdfUrls[1]).toBe("https://www.kumamura.com/kiji0035000/3_35000_2_def456.pdf");
    expect(pdfUrls[2]).toBe("https://www.kumamura.com/kiji0035000/3_35000_3_ghi789.pdf");
    expect(heldOn).toBe("2024-09-09");
  });

  it("絶対 URL の PDF リンクも処理する", () => {
    const html = `
      <a href="https://www.kumamura.com/kiji0034000/3_34000_1_xyz.pdf">PDF</a>
      <p>令和６年１月１５日（月曜日）</p>
    `;

    const { pdfUrls, heldOn } = parseDetailPage(html);

    expect(pdfUrls[0]).toBe("https://www.kumamura.com/kiji0034000/3_34000_1_xyz.pdf");
    expect(heldOn).toBe("2024-01-15");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>PDF なし</p></body></html>`;

    const { pdfUrls } = parseDetailPage(html);
    expect(pdfUrls).toHaveLength(0);
  });

  it("開催日がない場合は null を返す", () => {
    const html = `
      <a href="/kiji0035000/test.pdf">PDF</a>
      <p>日付情報なし</p>
    `;

    const { heldOn } = parseDetailPage(html);
    expect(heldOn).toBeNull();
  });

  it("平成の開催日を正しく変換する", () => {
    const html = `
      <a href="/kiji0020000/test.pdf">PDF</a>
      <p>平成３０年６月１２日（火曜日）</p>
    `;

    const { heldOn } = parseDetailPage(html);
    expect(heldOn).toBe("2018-06-12");
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <a href="/kiji0035000/3_35000_1_abc.pdf">PDF1</a>
      <a href="/kiji0035000/3_35000_1_abc.pdf">PDF1 (重複)</a>
      <p>令和６年９月９日</p>
    `;

    const { pdfUrls } = parseDetailPage(html);
    expect(pdfUrls).toHaveLength(1);
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和６年第８回定例会　会議録")).toBe(2024);
  });

  it("令和３年を正しく変換する", () => {
    expect(extractYearFromTitle("令和３年第６回臨時会　会議録")).toBe(2021);
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearFromTitle("令和元年第１回定例会　会議録")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromTitle("平成３０年第４回定例会　会議録")).toBe(2018);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});

describe("parseJapaneseDate", () => {
  it("令和の日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和６年９月９日～１７日")).toBe("2024-09-09");
  });

  it("平成の日付を正しく変換する", () => {
    expect(parseJapaneseDate("平成３０年３月１５日（木曜日）")).toBe("2018-03-15");
  });

  it("令和元年（漢字「元」）を正しく変換する", () => {
    expect(parseJapaneseDate("令和元年５月１日（水曜日）")).toBe("2019-05-01");
  });

  it("平成元年（漢字「元」）を正しく変換する", () => {
    expect(parseJapaneseDate("平成元年４月１日（土曜日）")).toBe("1989-04-01");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseJapaneseDate("日付情報なし")).toBeNull();
  });
});
