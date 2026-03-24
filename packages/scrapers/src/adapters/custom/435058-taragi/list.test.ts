import { describe, it, expect } from "vitest";
import {
  parseListPage,
  parseDetailPage,
} from "./list";
import {
  extractYearFromTitle,
  extractMonthFromTitle,
  buildHeldOnFromYearMonth,
  buildExternalId,
  extractDetailId,
} from "./shared";

describe("parseListPage", () => {
  it("詳細ページへのリンクを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="/gyousei/soshiki/gikai/gikaikaigiroku/3720.html">令和7年度第2回多良木町議会（7月会議）</a>
        </li>
        <li>
          <a href="/gyousei/soshiki/gikai/gikaikaigiroku/3600.html">令和6年度第5回多良木町議会（12月定例会議）</a>
        </li>
      </ul>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(2);
    expect(results[0]!.detailUrl).toBe(
      "https://www.town.taragi.lg.jp/gyousei/soshiki/gikai/gikaikaigiroku/3720.html"
    );
    expect(results[0]!.title).toBe("令和7年度第2回多良木町議会（7月会議）");
    expect(results[1]!.detailUrl).toBe(
      "https://www.town.taragi.lg.jp/gyousei/soshiki/gikai/gikaikaigiroku/3600.html"
    );
    expect(results[1]!.title).toBe("令和6年度第5回多良木町議会（12月定例会議）");
  });

  it("index.html は除外する", () => {
    const html = `
      <a href="/gyousei/soshiki/gikai/gikaikaigiroku/index.html">一覧</a>
      <a href="/gyousei/soshiki/gikai/gikaikaigiroku/3720.html">令和7年度第2回多良木町議会（7月会議）</a>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("令和7年度第2回多良木町議会（7月会議）");
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="/gyousei/soshiki/gikai/gikaikaigiroku/3720.html">タイトルA</a>
      <a href="/gyousei/soshiki/gikai/gikaikaigiroku/3720.html">タイトルB</a>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
  });

  it("該当リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const results = parseListPage(html);
    expect(results).toHaveLength(0);
  });

  it("絶対 URL のリンクも抽出する", () => {
    const html = `
      <a href="https://www.town.taragi.lg.jp/gyousei/soshiki/gikai/gikaikaigiroku/1198.html">平成29年度第3回多良木町議会（9月定例会議）</a>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.detailUrl).toBe(
      "https://www.town.taragi.lg.jp/gyousei/soshiki/gikai/gikaikaigiroku/1198.html"
    );
  });
});

describe("parseDetailPage", () => {
  it("PDF URL を 2 件抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和7年度第2回多良木町議会（7月会議）</h2>
        <a href="/material/files/group/12/nittei0710.pdf">会議日程</a>
        <a href="/material/files/group/12/kaigiroku0710.pdf">会議録</a>
      </body>
      </html>
    `;

    const { pdfUrls } = parseDetailPage(html);

    expect(pdfUrls).toHaveLength(2);
    expect(pdfUrls[0]).toBe(
      "https://www.town.taragi.lg.jp/material/files/group/12/nittei0710.pdf"
    );
    expect(pdfUrls[1]).toBe(
      "https://www.town.taragi.lg.jp/material/files/group/12/kaigiroku0710.pdf"
    );
  });

  it("日付連番形式の PDF URL も抽出する", () => {
    const html = `
      <a href="/material/files/group/12/20250311.pdf">会議日程</a>
      <a href="/material/files/group/12/20250312.pdf">会議録</a>
    `;

    const { pdfUrls } = parseDetailPage(html);

    expect(pdfUrls).toHaveLength(2);
    expect(pdfUrls[0]).toBe(
      "https://www.town.taragi.lg.jp/material/files/group/12/20250311.pdf"
    );
    expect(pdfUrls[1]).toBe(
      "https://www.town.taragi.lg.jp/material/files/group/12/20250312.pdf"
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>PDF なし</p></body></html>`;

    const { pdfUrls } = parseDetailPage(html);
    expect(pdfUrls).toHaveLength(0);
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <a href="/material/files/group/12/kaigiroku0710.pdf">会議録</a>
      <a href="/material/files/group/12/kaigiroku0710.pdf">会議録（重複）</a>
    `;

    const { pdfUrls } = parseDetailPage(html);
    expect(pdfUrls).toHaveLength(1);
  });

  it("絶対 URL の PDF リンクも処理する", () => {
    const html = `
      <a href="https://www.town.taragi.lg.jp/material/files/group/12/nittei0710.pdf">日程</a>
    `;

    const { pdfUrls } = parseDetailPage(html);
    expect(pdfUrls[0]).toBe(
      "https://www.town.taragi.lg.jp/material/files/group/12/nittei0710.pdf"
    );
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年度・4月以降の月は同じ西暦年を返す", () => {
    expect(extractYearFromTitle("令和6年度第5回多良木町議会（12月定例会議）")).toBe(2024);
  });

  it("令和の年度・1〜3月は翌年の西暦を返す", () => {
    expect(extractYearFromTitle("令和6年度第1回多良木町議会（3月定例会議）")).toBe(2025);
  });

  it("令和元年度を正しく変換する", () => {
    expect(extractYearFromTitle("令和元年度第1回多良木町議会（5月会議）")).toBe(2019);
  });

  it("平成の年度を正しく変換する", () => {
    expect(extractYearFromTitle("平成29年度第3回多良木町議会（9月定例会議）")).toBe(2017);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});

describe("extractMonthFromTitle", () => {
  it("開催月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年度第5回多良木町議会（12月定例会議）")).toBe(12);
  });

  it("1桁の月も抽出する", () => {
    expect(extractMonthFromTitle("令和7年度第2回多良木町議会（7月会議）")).toBe(7);
  });

  it("月が含まれない場合は null を返す", () => {
    expect(extractMonthFromTitle("会議録")).toBeNull();
  });
});

describe("buildHeldOnFromYearMonth", () => {
  it("YYYY-MM-01 形式を返す", () => {
    expect(buildHeldOnFromYearMonth(2024, 12)).toBe("2024-12-01");
  });

  it("月を 2 桁にゼロパディングする", () => {
    expect(buildHeldOnFromYearMonth(2019, 5)).toBe("2019-05-01");
  });
});

describe("buildExternalId", () => {
  it("taragi_ プレフィックスを付与する", () => {
    expect(buildExternalId("3720")).toBe("taragi_3720");
  });
});

describe("extractDetailId", () => {
  it("URL から ID を抽出する", () => {
    expect(
      extractDetailId(
        "https://www.town.taragi.lg.jp/gyousei/soshiki/gikai/gikaikaigiroku/3720.html"
      )
    ).toBe("3720");
  });

  it("相対パスからも ID を抽出する", () => {
    expect(
      extractDetailId("/gyousei/soshiki/gikai/gikaikaigiroku/1198.html")
    ).toBe("1198");
  });

  it("該当パターンがない場合は null を返す", () => {
    expect(extractDetailId("https://example.com/page.html")).toBeNull();
  });
});
