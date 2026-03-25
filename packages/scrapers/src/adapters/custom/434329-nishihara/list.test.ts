import { describe, it, expect } from "vitest";
import {
  parseListPage,
  parseNextPageUrl,
  parseDetailPage,
  parseArchivePage,
} from "./list";
import { parseJapaneseDate, extractYearFromTitle } from "./shared";

describe("parseListPage", () => {
  it("kiji リンクからエントリを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="/gikai/kiji0031869/index.html">令和７年第４回定例会会議録</a>
        </li>
        <li>
          <a href="/gikai/kiji0031766/index.html">令和７年第１回臨時会会議録</a>
        </li>
      </ul>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(2);
    expect(results[0]!.kijiId).toBe("0031869");
    expect(results[0]!.title).toBe("令和７年第４回定例会会議録");
    expect(results[1]!.kijiId).toBe("0031766");
    expect(results[1]!.title).toBe("令和７年第１回臨時会会議録");
  });

  it("重複する kijiId は除外する", () => {
    const html = `
      <a href="/gikai/kiji0031869/index.html">タイトルA</a>
      <a href="/gikai/kiji0031869/index.html">タイトルB</a>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
  });

  it("kiji リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const results = parseListPage(html);
    expect(results).toHaveLength(0);
  });

  it("絶対 URL の kiji リンクも抽出する", () => {
    const html = `
      <li>
        <a href="https://www.vill.nishihara.kumamoto.jp/gikai/kiji003295/index.html">平成24年〜令和4年会議録</a>
      </li>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.kijiId).toBe("003295");
  });
});

describe("parseNextPageUrl", () => {
  it("rel='next1' リンクから次ページ URL を返す", () => {
    const html = `
      <a id="nextload1" rel="next1" href="/gikai/list00557p2.html">もっと見る</a>
    `;

    const result = parseNextPageUrl(html);
    expect(result).toBe("https://www.vill.nishihara.kumamoto.jp/gikai/list00557p2.html");
  });

  it("rel='next1' リンクがない場合は null を返す", () => {
    const html = `<html><body><p>ページネーションなし</p></body></html>`;

    const result = parseNextPageUrl(html);
    expect(result).toBeNull();
  });

  it("href が絶対 URL でもそのまま返す", () => {
    const html = `
      <a href="https://www.vill.nishihara.kumamoto.jp/gikai/list00557p3.html" rel="next1">もっと見る</a>
    `;

    const result = parseNextPageUrl(html);
    expect(result).toBe("https://www.vill.nishihara.kumamoto.jp/gikai/list00557p3.html");
  });
});

describe("parseDetailPage", () => {
  it("PDF URL と開催日を抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和７年第４回定例会会議録</h2>
        <p>令和7年3月10日</p>
        <a href="/gikai/kiji0031869/3_1869_2857_up_qg74xpay.pdf">会議録（PDF）</a>
      </body>
      </html>
    `;
    const detailUrl = "https://www.vill.nishihara.kumamoto.jp/gikai/kiji0031869/index.html";

    const { pdfUrl, heldOn } = parseDetailPage(html, detailUrl);

    expect(pdfUrl).toBe("https://www.vill.nishihara.kumamoto.jp/gikai/kiji0031869/3_1869_2857_up_qg74xpay.pdf");
    expect(heldOn).toBe("2025-03-10");
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `<html><body><p>PDF なし</p></body></html>`;
    const detailUrl = "https://www.vill.nishihara.kumamoto.jp/gikai/kiji0031869/index.html";

    const { pdfUrl } = parseDetailPage(html, detailUrl);
    expect(pdfUrl).toBeNull();
  });

  it("開催日がない場合は null を返す", () => {
    const html = `
      <a href="/gikai/kiji0031869/test.pdf">PDF</a>
      <p>日付情報なし</p>
    `;
    const detailUrl = "https://www.vill.nishihara.kumamoto.jp/gikai/kiji0031869/index.html";

    const { heldOn } = parseDetailPage(html, detailUrl);
    expect(heldOn).toBeNull();
  });

  it("平成の開催日を正しく変換する", () => {
    const html = `
      <a href="/gikai/kiji0020000/test.pdf">PDF</a>
      <p>平成３０年６月１２日（火曜日）</p>
    `;
    const detailUrl = "https://www.vill.nishihara.kumamoto.jp/gikai/kiji0020000/index.html";

    const { heldOn } = parseDetailPage(html, detailUrl);
    expect(heldOn).toBe("2018-06-12");
  });

  it("相対パスの PDF URL を絶対 URL に変換する", () => {
    const html = `
      <a href="test_file.pdf">PDF</a>
      <p>令和6年9月10日</p>
    `;
    const detailUrl = "https://www.vill.nishihara.kumamoto.jp/gikai/kiji0030000/index.html";

    const { pdfUrl } = parseDetailPage(html, detailUrl);
    expect(pdfUrl).toBe("https://www.vill.nishihara.kumamoto.jp/gikai/kiji0030000/test_file.pdf");
  });
});

describe("parseArchivePage", () => {
  it("アーカイブページから PDF エントリを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="/gikai/kiji003295/R4_4th_regular.pdf">令和4年第4回定例会会議録（PDF：1MB）</a>
        </li>
        <li>
          <a href="/gikai/kiji003295/R4_1st_extra.pdf">令和4年第1回臨時会会議録（PDF：500KB）</a>
        </li>
        <li>
          <a href="/gikai/kiji003295/H30_4th_regular.pdf">平成30年第4回定例会会議録（PDF：800KB）</a>
        </li>
      </ul>
    `;

    const results = parseArchivePage(html);

    expect(results).toHaveLength(3);
    expect(results[0]!.title).toBe("令和4年第4回定例会会議録");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.vill.nishihara.kumamoto.jp/gikai/kiji003295/R4_4th_regular.pdf"
    );
    expect(results[1]!.title).toBe("令和4年第1回臨時会会議録");
    expect(results[2]!.title).toBe("平成30年第4回定例会会議録");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const results = parseArchivePage(html);
    expect(results).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクも処理する", () => {
    const html = `
      <a href="https://www.vill.nishihara.kumamoto.jp/gikai/kiji003295/R3_test.pdf">令和3年第2回定例会会議録（PDF：700KB）</a>
    `;

    const results = parseArchivePage(html);
    expect(results[0]!.pdfUrl).toBe(
      "https://www.vill.nishihara.kumamoto.jp/gikai/kiji003295/R3_test.pdf"
    );
    expect(results[0]!.title).toBe("令和3年第2回定例会会議録");
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和６年第４回定例会会議録")).toBe(2024);
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearFromTitle("令和元年第１回定例会会議録")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromTitle("平成３０年第４回定例会会議録")).toBe(2018);
  });

  it("全角数字を正しく変換する", () => {
    expect(extractYearFromTitle("令和４年第２回臨時会会議録")).toBe(2022);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});

describe("parseJapaneseDate", () => {
  it("令和の日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和6年9月10日")).toBe("2024-09-10");
  });

  it("全角数字の日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和６年９月１０日")).toBe("2024-09-10");
  });

  it("平成の日付を正しく変換する", () => {
    expect(parseJapaneseDate("平成３０年３月１５日（木曜日）")).toBe("2018-03-15");
  });

  it("令和元年を正しく変換する", () => {
    expect(parseJapaneseDate("令和元年５月１日（水曜日）")).toBe("2019-05-01");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseJapaneseDate("日付情報なし")).toBeNull();
  });
});
