import { describe, expect, it } from "vitest";
import {
  parseTopPage,
  parseYearCategoryPage,
  parseMeetingTypePage,
  parseDetailPage,
  parseDateFromText,
} from "./list";

describe("parseTopPage", () => {
  it("年度別カテゴリリンクを抽出する", () => {
    const html = `
      <html><body>
      <ul>
        <li><a href="/gyosei/council/?category=308">2024年（令和6年分）</a></li>
        <li><a href="/gyosei/council/?category=239">2023年（令和5年分）</a></li>
        <li><a href="/gyosei/council/?category=236">2022年（令和4年分）</a></li>
      </ul>
      </body></html>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.categoryId).toBe("308");
    expect(result[0]!.year).toBe(2024);
    expect(result[1]!.categoryId).toBe("239");
    expect(result[1]!.year).toBe(2023);
    expect(result[2]!.categoryId).toBe("236");
    expect(result[2]!.year).toBe(2022);
  });

  it("トップカテゴリ（220）はスキップする", () => {
    const html = `
      <a href="/gyosei/council/?category=220">審議の結果トップ</a>
      <a href="/gyosei/council/?category=308">2024年（令和6年分）</a>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.categoryId).toBe("308");
  });

  it("年度パターンに合致しないリンクはスキップする", () => {
    const html = `
      <a href="/gyosei/council/?category=999">関係ないリンク</a>
      <a href="/gyosei/council/?category=308">2024年（令和6年分）</a>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>内容なし</p></body></html>`;
    const result = parseTopPage(html);
    expect(result).toHaveLength(0);
  });
});

describe("parseYearCategoryPage", () => {
  it("会議種別カテゴリリンクを抽出する", () => {
    const html = `
      <html><body>
      <ul>
        <li><a href="/gyosei/council/?category=309">本会議</a></li>
        <li><a href="/gyosei/council/?category=310">総務産業建設常任委員会</a></li>
        <li><a href="/gyosei/council/?category=311">厚生文教常任委員会</a></li>
      </ul>
      </body></html>
    `;

    const result = parseYearCategoryPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.categoryId).toBe("309");
    expect(result[0]!.typeName).toBe("本会議");
    expect(result[1]!.categoryId).toBe("310");
    expect(result[1]!.typeName).toBe("総務産業建設常任委員会");
    expect(result[2]!.categoryId).toBe("311");
    expect(result[2]!.typeName).toBe("厚生文教常任委員会");
  });

  it("重複するカテゴリ ID を除外する", () => {
    const html = `
      <a href="/gyosei/council/?category=309">本会議</a>
      <a href="/gyosei/council/?category=309">本会議（重複）</a>
    `;

    const result = parseYearCategoryPage(html);
    expect(result).toHaveLength(1);
  });

  it("会議・議会・委員会に関係ないリンクはスキップする", () => {
    const html = `
      <a href="/gyosei/council/?category=100">その他</a>
      <a href="/gyosei/council/?category=309">本会議</a>
    `;

    const result = parseYearCategoryPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.categoryId).toBe("309");
  });
});

describe("parseMeetingTypePage", () => {
  it("詳細ページ（コンテンツ ID）のリンクを抽出する", () => {
    const html = `
      <html><body>
      <ul>
        <li><a href="/gyosei/council/?content=3355">第8回浦河町議会定例会</a></li>
        <li><a href="/gyosei/council/?content=3321">第7回臨時会</a></li>
        <li><a href="/gyosei/council/?content=3290">第6回定例会</a></li>
      </ul>
      </body></html>
    `;

    const result = parseMeetingTypePage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.contentId).toBe("3355");
    expect(result[0]!.title).toBe("第8回浦河町議会定例会");
    expect(result[1]!.contentId).toBe("3321");
    expect(result[1]!.title).toBe("第7回臨時会");
  });

  it("重複するコンテンツ ID を除外する", () => {
    const html = `
      <a href="/gyosei/council/?content=3355">第8回浦河町議会定例会</a>
      <a href="/gyosei/council/?content=3355">第8回浦河町議会定例会（重複）</a>
    `;

    const result = parseMeetingTypePage(html);
    expect(result).toHaveLength(1);
  });

  it("コンテンツリンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>内容なし</p></body></html>`;
    const result = parseMeetingTypePage(html);
    expect(result).toHaveLength(0);
  });
});

describe("parseDetailPage", () => {
  it("PDF リンクとメタ情報を抽出する", () => {
    const html = `
      <html><body>
      <h2>第8回浦河町議会定例会</h2>
      <ul>
        <li>
          令和6年12月10日
          <a href="../../assets/images/content/content_20241210_150000.pdf">令和6年12月10日 [PDF｜500 KB]</a>
        </li>
        <li>
          令和6年12月11日
          <a href="../../assets/images/content/content_20241211_100000.pdf">令和6年12月11日 [PDF｜480 KB]</a>
        </li>
      </ul>
      </body></html>
    `;

    const result = parseDetailPage(html, "第8回浦河町議会定例会", "3355", "plenary");

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.urakawa.hokkaido.jp/gyosei/assets/images/content/content_20241210_150000.pdf",
    );
    expect(result[0]!.heldOn).toBe("2024-12-10");
    expect(result[0]!.title).toBe("第8回浦河町議会定例会");
    expect(result[0]!.category).toBe("plenary");
    expect(result[0]!.pdfKey).toBe("016071_content3355_20241210_150000");
    expect(result[0]!.contentId).toBe("3355");

    expect(result[1]!.pdfUrl).toBe(
      "https://www.town.urakawa.hokkaido.jp/gyosei/assets/images/content/content_20241211_100000.pdf",
    );
    expect(result[1]!.heldOn).toBe("2024-12-11");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>第8回浦河町議会定例会</h2>
      <p>会議録は準備中です。</p>
    `;
    const result = parseDetailPage(html, "第8回浦河町議会定例会", "3355", "plenary");
    expect(result).toHaveLength(0);
  });

  it("委員会は committee カテゴリで設定される", () => {
    const html = `
      <a href="../../assets/images/content/content_20241115_100000.pdf">令和6年11月15日 [PDF｜300 KB]</a>
    `;
    const result = parseDetailPage(
      html,
      "令和6年11月15日",
      "3307",
      "committee",
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.category).toBe("committee");
  });

  it("タイムスタンプから日付を補完する", () => {
    // 周辺に和暦テキストがなくてもタイムスタンプから日付を取得できる
    const html = `
      <a href="../../assets/images/content/content_20240301_090000.pdf">会議録 [PDF｜400 KB]</a>
    `;
    const result = parseDetailPage(html, "第1回定例会", "3000", "plenary");
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-03-01");
  });
});

describe("parseDateFromText", () => {
  it("令和の年月日（半角）をパースする", () => {
    expect(parseDateFromText("令和6年12月10日")).toBe("2024-12-10");
  });

  it("令和の年月日（全角数字）をパースする", () => {
    expect(parseDateFromText("令和６年１２月１０日")).toBe("2024-12-10");
  });

  it("令和元年をパースする", () => {
    expect(parseDateFromText("令和元年6月3日")).toBe("2019-06-03");
  });

  it("平成の年月日をパースする", () => {
    expect(parseDateFromText("平成31年3月1日")).toBe("2019-03-01");
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(parseDateFromText("浦河町議会定例会")).toBeNull();
  });
});
