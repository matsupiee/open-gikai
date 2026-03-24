import { describe, expect, it } from "vitest";
import {
  extractYearFromTitle,
  parseJapaneseDate,
} from "./shared";
import { parseKijiPage, parseTopListPage, parseYearListPage } from "./list";

describe("parseTopListPage", () => {
  it("年度別リストページの ID を抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="https://www.town.yunomae.lg.jp/gikai/list00985.html">令和8年湯前町議会会議録</a>
        </li>
        <li>
          <a href="https://www.town.yunomae.lg.jp/gikai/list00962.html">令和7年湯前町議会会議録</a>
        </li>
        <li>
          <a href="https://www.town.yunomae.lg.jp/gikai/list00911.html">令和6年湯前町議会会議録</a>
        </li>
      </ul>
    `;

    const listIds = parseTopListPage(html);

    expect(listIds).toHaveLength(3);
    expect(listIds[0]).toBe("00985");
    expect(listIds[1]).toBe("00962");
    expect(listIds[2]).toBe("00911");
  });

  it("トップページ自身（list00557）は除外する", () => {
    const html = `
      <a href="https://www.town.yunomae.lg.jp/gikai/list00557.html">会議録トップ</a>
      <a href="https://www.town.yunomae.lg.jp/gikai/list00962.html">令和7年</a>
    `;

    const listIds = parseTopListPage(html);

    expect(listIds).toHaveLength(1);
    expect(listIds[0]).toBe("00962");
  });

  it("重複する listId は除外する", () => {
    const html = `
      <a href="/gikai/list00962.html">令和7年</a>
      <a href="/gikai/list00962.html">令和7年（重複）</a>
    `;

    const listIds = parseTopListPage(html);
    expect(listIds).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const listIds = parseTopListPage(html);
    expect(listIds).toHaveLength(0);
  });
});

describe("parseYearListPage", () => {
  it("kiji ページへのリンクから ID を抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="https://www.town.yunomae.lg.jp/gikai/kiji4967/index.html">令和7年湯前町議会会議録</a>
        </li>
      </ul>
    `;

    const kijiIds = parseYearListPage(html);

    expect(kijiIds).toHaveLength(1);
    expect(kijiIds[0]).toBe("4967");
  });

  it("相対パスの kiji リンクも抽出する", () => {
    const html = `
      <a href="/gikai/kiji4429/index.html">令和6年湯前町議会会議録</a>
    `;

    const kijiIds = parseYearListPage(html);

    expect(kijiIds).toHaveLength(1);
    expect(kijiIds[0]).toBe("4429");
  });

  it("kiji リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const kijiIds = parseYearListPage(html);
    expect(kijiIds).toHaveLength(0);
  });
});

describe("parseKijiPage", () => {
  it("セクション名と PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>■令和7年第3回定例会（3月6日～3月14日）</li>
        <li>
          <a href="/gikai/kiji4967/3_4967_7551_up_a1e1iqiy.pdf">会議録 PDF</a>
        </li>
      </ul>
    `;

    const results = parseKijiPage(html, "4967", 2025);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("■令和7年第3回定例会（3月6日～3月14日）");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.yunomae.lg.jp/gikai/kiji4967/3_4967_7551_up_a1e1iqiy.pdf"
    );
    expect(results[0]!.heldOn).toBe("2025-03-06");
  });

  it("複数のセクションと PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>■令和6年第1回臨時会（1月29日）</li>
        <li>
          <a href="/gikai/kiji4429/3_4429_up_lhegyoei.pdf">臨時会会議録</a>
        </li>
        <li>■令和6年第1回定例会（3月5日～3月12日）</li>
        <li>
          <a href="/gikai/kiji4429/3_4429_7547_up_81ajmzjx.pdf">定例会会議録</a>
        </li>
      </ul>
    `;

    const results = parseKijiPage(html, "4429", 2024);

    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("■令和6年第1回臨時会（1月29日）");
    expect(results[0]!.heldOn).toBe("2024-01-29");
    expect(results[1]!.title).toBe("■令和6年第1回定例会（3月5日～3月12日）");
    expect(results[1]!.heldOn).toBe("2024-03-05");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>PDF なし</p></body></html>`;

    const results = parseKijiPage(html, "4429", 2024);
    expect(results).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクも処理する", () => {
    const html = `
      <li>■令和7年第1回臨時会（1月15日）</li>
      <li>
        <a href="https://www.town.yunomae.lg.jp/gikai/kiji4967/3_4967_up_xyz12345.pdf">会議録</a>
      </li>
    `;

    const results = parseKijiPage(html, "4967", 2025);

    expect(results).toHaveLength(1);
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.yunomae.lg.jp/gikai/kiji4967/3_4967_up_xyz12345.pdf"
    );
  });

  it("開催日が解析できない場合は heldOn が null", () => {
    const html = `
      <li>■会議録（日付なし）</li>
      <li>
        <a href="/gikai/kiji4429/3_4429_up_xxxxxxxx.pdf">会議録</a>
      </li>
    `;

    const results = parseKijiPage(html, "4429", 2024);

    expect(results).toHaveLength(1);
    expect(results[0]!.heldOn).toBeNull();
  });
});

describe("extractYearFromTitle", () => {
  it("令和7年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和7年湯前町議会会議録")).toBe(2025);
  });

  it("令和6年を正しく変換する", () => {
    expect(extractYearFromTitle("令和6年第1回定例会")).toBe(2024);
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearFromTitle("令和元年湯前町議会会議録")).toBe(2019);
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
    expect(parseJapaneseDate("■令和7年第3回定例会（3月6日～3月14日）")).toBe("2025-03-06");
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
