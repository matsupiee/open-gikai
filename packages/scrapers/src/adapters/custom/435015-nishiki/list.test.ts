import { describe, expect, it } from "vitest";
import {
  extractYearFromTitle,
  parseJapaneseDate,
} from "./shared";
import { parseListPage, parseYearPage } from "./list";

describe("parseListPage", () => {
  it("kiji リンクから年度別ページの ID を抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="https://www.town.kumamoto-nishiki.lg.jp/kiji0031174/index.html">錦町議会会議録（定例会・臨時会）</a>
        </li>
        <li>
          <a href="https://www.town.kumamoto-nishiki.lg.jp/kiji0031024/index.html">錦町議会会議録（定例会・臨時会）</a>
        </li>
        <li>
          <a href="https://www.town.kumamoto-nishiki.lg.jp/kiji003905/index.html">錦町議会会議録（定例会・臨時会）</a>
        </li>
      </ul>
    `;

    const kijiIds = parseListPage(html);

    expect(kijiIds).toHaveLength(3);
    expect(kijiIds[0]).toBe("0031174");
    expect(kijiIds[1]).toBe("0031024");
    expect(kijiIds[2]).toBe("003905");
  });

  it("相対パスの kiji リンクも抽出する", () => {
    const html = `
      <li>
        <a href="/kiji003742/index.html">錦町議会会議録（定例会・臨時会）</a>
      </li>
    `;

    const kijiIds = parseListPage(html);

    expect(kijiIds).toHaveLength(1);
    expect(kijiIds[0]).toBe("003742");
  });

  it("重複する kijiId は除外する", () => {
    const html = `
      <a href="/kiji003905/index.html">リンクA</a>
      <a href="/kiji003905/index.html">リンクB</a>
    `;

    const kijiIds = parseListPage(html);
    expect(kijiIds).toHaveLength(1);
  });

  it("kiji リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const kijiIds = parseListPage(html);
    expect(kijiIds).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("PDF リンクとタイトル・開催日を抽出する", () => {
    const html = `
      <html>
      <body>
        <a href="/kiji003905/3_905_1562_up_7s5zus0d.pdf">令和6年第1回議会定例会（3月5日～3月12日）</a>
        <a href="/kiji003905/3_905_1759_up_kgxrbqi0.pdf">令和6年第2回議会定例会（6月11日～6月14日）</a>
      </body>
      </html>
    `;

    const results = parseYearPage(html, "003905", 2024);

    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("令和6年第1回議会定例会（3月5日～3月12日）");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.kumamoto-nishiki.lg.jp/kiji003905/3_905_1562_up_7s5zus0d.pdf"
    );
    expect(results[0]!.heldOn).toBe("2024-03-05");
    expect(results[1]!.heldOn).toBe("2024-06-11");
  });

  it("絶対 URL の PDF リンクも処理する", () => {
    const html = `
      <a href="https://www.town.kumamoto-nishiki.lg.jp/kiji003905/3_905_1563_up_2emll1x7.pdf">令和6年第1回臨時会（1月29日）</a>
    `;

    const results = parseYearPage(html, "003905", 2024);

    expect(results).toHaveLength(1);
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.kumamoto-nishiki.lg.jp/kiji003905/3_905_1563_up_2emll1x7.pdf"
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>PDF なし</p></body></html>`;

    const results = parseYearPage(html, "003905", 2024);
    expect(results).toHaveLength(0);
  });

  it("開催日がない場合は heldOn が null", () => {
    const html = `
      <a href="/kiji003905/3_905_9999_up_xxxxxxxx.pdf">会議録（日付なし）</a>
    `;

    const results = parseYearPage(html, "003905", 2024);

    expect(results).toHaveLength(1);
    expect(results[0]!.heldOn).toBeNull();
  });

  it("臨時会のリンクも抽出する", () => {
    const html = `
      <a href="/kiji003905/3_905_1563_up_2emll1x7.pdf">令和6年第1回臨時会（1月29日）</a>
      <a href="/kiji003905/3_905_1760_up_0jbg0kz3.pdf">令和6年第3回臨時会（8月1日）</a>
    `;

    const results = parseYearPage(html, "003905", 2024);

    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("令和6年第1回臨時会（1月29日）");
    expect(results[1]!.title).toBe("令和6年第3回臨時会（8月1日）");
  });
});

describe("extractYearFromTitle", () => {
  it("令和6年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和6年第1回議会定例会")).toBe(2024);
  });

  it("令和5年を正しく変換する", () => {
    expect(extractYearFromTitle("令和5年第4回定例会")).toBe(2023);
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearFromTitle("令和元年第1回定例会")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromTitle("平成30年第4回定例会")).toBe(2018);
  });

  it("全角数字を正しく変換する", () => {
    expect(extractYearFromTitle("令和６年第１回定例会")).toBe(2024);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});

describe("parseJapaneseDate", () => {
  it("令和の日付（年月日あり）を正しく変換する", () => {
    expect(parseJapaneseDate("令和6年第1回議会定例会（3月5日～3月12日）")).toBe("2024-03-05");
  });

  it("平成の日付を正しく変換する", () => {
    expect(parseJapaneseDate("平成30年第4回定例会（12月10日～12月13日）")).toBe("2018-12-10");
  });

  it("令和元年（漢字「元」）を正しく変換する", () => {
    expect(parseJapaneseDate("令和元年第1回定例会（6月1日）")).toBe("2019-06-01");
  });

  it("年情報なしで yearHint を使用する", () => {
    expect(parseJapaneseDate("第1回臨時会（1月29日）", 2024)).toBe("2024-01-29");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseJapaneseDate("日付情報なし")).toBeNull();
  });

  it("全角数字の日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和６年第１回定例会（３月５日）")).toBe("2024-03-05");
  });
});
