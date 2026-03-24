import { describe, expect, it } from "vitest";
import { parseYearPageIds, parseYearPage } from "./list";
import { parseWarekiDate } from "./shared";

describe("parseWarekiDate", () => {
  it("令和6年4月25日 を 2024-04-25 に変換する", () => {
    expect(parseWarekiDate("令和6年4月25日")).toBe("2024-04-25");
  });

  it("令和元年7月1日 を 2019-07-01 に変換する", () => {
    expect(parseWarekiDate("令和元年7月1日")).toBe("2019-07-01");
  });

  it("平成31年1月28日 を 2019-01-28 に変換する", () => {
    expect(parseWarekiDate("平成31年1月28日")).toBe("2019-01-28");
  });

  it("平成元年4月1日 を 1989-04-01 に変換する", () => {
    expect(parseWarekiDate("平成元年4月1日")).toBe("1989-04-01");
  });

  it("解析できない場合は null を返す", () => {
    expect(parseWarekiDate("令和6年4月")).toBeNull();
    expect(parseWarekiDate("2024-04-25")).toBeNull();
    expect(parseWarekiDate("")).toBeNull();
  });
});

describe("parseYearPageIds", () => {
  it("起点ページ HTML から年度別ページの content ID を抽出する", () => {
    const html = `
      <html>
      <body>
        <a href="?content=1429">令和7年</a>
        <a href="?content=800">令和6年</a>
        <a href="?content=92">令和5年</a>
        <a href="?content=91">令和4年（起点）</a>
      </body>
      </html>
    `;

    const ids = parseYearPageIds(html);

    // content=91 (INDEX_CONTENT_ID) は除外される
    expect(ids).toContain("1429");
    expect(ids).toContain("800");
    expect(ids).toContain("92");
    expect(ids).not.toContain("91");
  });

  it("重複する content ID を除外する", () => {
    const html = `
      <a href="?content=800">令和6年</a>
      <a href="?content=800">令和6年（再掲）</a>
    `;

    const ids = parseYearPageIds(html);
    expect(ids.filter((id) => id === "800")).toHaveLength(1);
  });

  it("content ID がない HTML では空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;
    expect(parseYearPageIds(html)).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("年度別ページから PDF リンクとメタ情報を抽出する", () => {
    const pageUrl = "https://www.town.kyowa.hokkaido.jp/education/?content=800";
    const html = `
      <html>
      <body>
        <p>令和6年度教育委員会会議録</p>
        <ul>
          <li>
            <a href="../../assets/images/content/content_20240122_180527.pdf">
              第1回会議録（令和6年1月22日）
            </a>
          </li>
          <li>
            <a href="../../assets/images/content/content_20240425_150000.pdf">
              第2回会議録（令和6年4月25日）
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const documents = parseYearPage(html, pageUrl);

    expect(documents).toHaveLength(2);
    expect(documents[0]!.pdfUrl).toBe(
      "https://www.town.kyowa.hokkaido.jp/assets/images/content/content_20240122_180527.pdf",
    );
    expect(documents[0]!.title).toBe("第1回会議録");
    expect(documents[0]!.heldOn).toBe("2024-01-22");

    expect(documents[1]!.pdfUrl).toBe(
      "https://www.town.kyowa.hokkaido.jp/assets/images/content/content_20240425_150000.pdf",
    );
    expect(documents[1]!.heldOn).toBe("2024-04-25");
  });

  it("絶対パスの PDF URL もそのまま使う", () => {
    const pageUrl = "https://www.town.kyowa.hokkaido.jp/education/?content=800";
    const html = `
      <a href="https://www.town.kyowa.hokkaido.jp/assets/images/content/content_20240122_180527.pdf">
        第1回会議録（令和6年1月22日）
      </a>
    `;

    const documents = parseYearPage(html, pageUrl);
    expect(documents).toHaveLength(1);
    expect(documents[0]!.pdfUrl).toBe(
      "https://www.town.kyowa.hokkaido.jp/assets/images/content/content_20240122_180527.pdf",
    );
  });

  it("日付が含まれない場合は heldOn が null になる", () => {
    const pageUrl = "https://www.town.kyowa.hokkaido.jp/education/?content=800";
    const html = `
      <a href="../../assets/images/content/content_20240122_180527.pdf">
        第1回会議録
      </a>
    `;

    const documents = parseYearPage(html, pageUrl);
    expect(documents).toHaveLength(1);
    expect(documents[0]!.heldOn).toBeNull();
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const pageUrl = "https://www.town.kyowa.hokkaido.jp/education/?content=800";
    const html = `<html><body><p>準備中</p></body></html>`;
    expect(parseYearPage(html, pageUrl)).toHaveLength(0);
  });

  it("同じ PDF URL の重複を除外する", () => {
    const pageUrl = "https://www.town.kyowa.hokkaido.jp/education/?content=800";
    const html = `
      <a href="../../assets/images/content/content_20240122_180527.pdf">第1回（令和6年1月22日）</a>
      <a href="../../assets/images/content/content_20240122_180527.pdf">第1回（令和6年1月22日）（再掲）</a>
    `;

    const documents = parseYearPage(html, pageUrl);
    expect(documents).toHaveLength(1);
  });

  it("令和元年の日付を正しく処理する", () => {
    const pageUrl = "https://www.town.kyowa.hokkaido.jp/education/?content=88";
    const html = `
      <a href="../../assets/images/content/content_20190701_120000.pdf">
        第1回会議録（令和元年7月1日）
      </a>
    `;

    const documents = parseYearPage(html, pageUrl);
    expect(documents).toHaveLength(1);
    expect(documents[0]!.heldOn).toBe("2019-07-01");
  });
});
