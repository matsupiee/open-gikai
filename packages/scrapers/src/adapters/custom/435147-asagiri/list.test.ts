import { describe, it, expect } from "vitest";
import { parseListPage, parseDetailPage } from "./list";
import { parseJapaneseDate } from "./shared";

describe("parseListPage", () => {
  it("kiji リンクからエントリを抽出する", () => {
    const html = `
      <ul>
        <li>
          <span class="upddate">2026年3月16日更新</span>
          <a href="https://www.town.asagiri.lg.jp/kiji0035107/index.html">令和7年度 第7回あさぎり町議会会議会議録</a>
        </li>
        <li>
          <span class="upddate">2026年1月6日更新</span>
          <a href="https://www.town.asagiri.lg.jp/kiji0034955/index.html">令和7年度 第4回あさぎり町議会会議（9月定例日）会議録</a>
        </li>
      </ul>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(2);
    expect(results[0]!.kijiId).toBe("0035107");
    expect(results[0]!.title).toBe("令和7年度 第7回あさぎり町議会会議会議録");
    expect(results[1]!.kijiId).toBe("0034955");
    expect(results[1]!.title).toBe("令和7年度 第4回あさぎり町議会会議（9月定例日）会議録");
  });

  it("重複する kijiId は除外する", () => {
    const html = `
      <a href="/kiji0035107/index.html">タイトルA</a>
      <a href="/kiji0035107/index.html">タイトルB</a>
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
        <a href="/kiji0032548/index.html">令和4年度 第7回あさぎり町議会会議会議録</a>
      </li>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.kijiId).toBe("0032548");
  });
});

describe("parseDetailPage", () => {
  it("PDF URL と開催日を抽出する", () => {
    const html = `
      <html>
      <body>
        <h1>令和7年度 第7回あさぎり町議会会議会議録</h1>
        <p>最終更新日：2026年3月16日</p>
        <p>令和８年１月１５日（木曜日）</p>
        <a href="/kiji0035107/3_5107_up_citq3qds.pdf">令和7年度第7回会議会議録（PDF：1.16メガバイト）</a>
      </body>
      </html>
    `;

    const { pdfUrl, heldOn } = parseDetailPage(html);

    expect(pdfUrl).toBe("https://www.town.asagiri.lg.jp/kiji0035107/3_5107_up_citq3qds.pdf");
    expect(heldOn).toBe("2026-01-15");
  });

  it("絶対 URL の PDF リンクも処理する", () => {
    const html = `
      <a href="https://www.town.asagiri.lg.jp/kiji0034955/3_4955_up_xbaqqeil.pdf">PDF</a>
      <p>令和７年９月８日（月曜日）～１９日（金曜日）</p>
    `;

    const { pdfUrl, heldOn } = parseDetailPage(html);

    expect(pdfUrl).toBe("https://www.town.asagiri.lg.jp/kiji0034955/3_4955_up_xbaqqeil.pdf");
    expect(heldOn).toBe("2025-09-08");
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `<html><body><p>PDF なし</p></body></html>`;

    const { pdfUrl } = parseDetailPage(html);
    expect(pdfUrl).toBeNull();
  });

  it("開催日がない場合は null を返す", () => {
    const html = `
      <a href="/kiji0035107/test.pdf">PDF</a>
      <p>日付情報なし</p>
    `;

    const { heldOn } = parseDetailPage(html);
    expect(heldOn).toBeNull();
  });

  it("平成の開催日を正しく変換する", () => {
    const html = `
      <a href="/kiji0030000/test.pdf">PDF</a>
      <p>平成３０年６月１２日（火曜日）</p>
    `;

    const { heldOn } = parseDetailPage(html);
    expect(heldOn).toBe("2018-06-12");
  });
});

describe("parseJapaneseDate", () => {
  it("令和の日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和７年６月１０日（火曜日）")).toBe("2025-06-10");
  });

  it("平成の日付を正しく変換する", () => {
    expect(parseJapaneseDate("平成３０年３月１５日（木曜日）")).toBe("2018-03-15");
  });

  it("平成元年（数字）を正しく変換する", () => {
    expect(parseJapaneseDate("平成１年４月１日（土曜日）")).toBe("1989-04-01");
  });

  it("令和元年（数字）を正しく変換する", () => {
    expect(parseJapaneseDate("令和１年５月１日（水曜日）")).toBe("2019-05-01");
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
