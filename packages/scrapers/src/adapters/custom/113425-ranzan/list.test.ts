import { describe, expect, it } from "vitest";
import {
  buildHeldOn,
  parseArticleUrls,
  parseCategoryUrls,
  parsePdfUrl,
} from "./list";
import { eraToWesternYear, fileNameToMonth, fileNameToYear } from "./shared";

describe("eraToWesternYear", () => {
  it("令和6年 → 2024", () => {
    expect(eraToWesternYear("令和6年")).toBe(2024);
  });

  it("令和7年 → 2025", () => {
    expect(eraToWesternYear("令和7年")).toBe(2025);
  });

  it("令和元年 → 2019", () => {
    expect(eraToWesternYear("令和元年")).toBe(2019);
  });

  it("平成20年 → 2008", () => {
    expect(eraToWesternYear("平成20年")).toBe(2008);
  });

  it("平成31年 → 2019", () => {
    expect(eraToWesternYear("平成31年")).toBe(2019);
  });

  it("不正なテキストは null を返す", () => {
    expect(eraToWesternYear("2024年")).toBeNull();
  });
});

describe("fileNameToYear", () => {
  it("R0709K.pdf → 2025 (令和7年)", () => {
    expect(fileNameToYear("R0709K.pdf")).toBe(2025);
  });

  it("R0603T.pdf → 2024 (令和6年)", () => {
    expect(fileNameToYear("R0603T.pdf")).toBe(2024);
  });

  it("R0103T.pdf → 2019 (令和1年)", () => {
    expect(fileNameToYear("R0103T.pdf")).toBe(2019);
  });

  it("不正なファイル名は null を返す", () => {
    expect(fileNameToYear("document.pdf")).toBeNull();
  });
});

describe("fileNameToMonth", () => {
  it("R0709K.pdf → 9", () => {
    expect(fileNameToMonth("R0709K.pdf")).toBe(9);
  });

  it("R0703T.pdf → 3", () => {
    expect(fileNameToMonth("R0703T.pdf")).toBe(3);
  });

  it("R0712T.pdf → 12", () => {
    expect(fileNameToMonth("R0712T.pdf")).toBe(12);
  });

  it("不正なファイル名は null を返す", () => {
    expect(fileNameToMonth("document.pdf")).toBeNull();
  });
});

describe("parseCategoryUrls", () => {
  it("年度別カテゴリ URL を抽出する", () => {
    const html = `
      <h2><a href="../category/2-19-9-18-0-0-0-0-0-0.html">令和7年</a></h2>
      <h2><a href="../category/2-19-9-17-0-0-0-0-0-0.html">令和6年</a></h2>
      <h2><a href="../category/2-19-9-1-0-0-0-0-0-0.html">令和5年</a></h2>
    `;

    const categories = parseCategoryUrls(html);

    expect(categories).toHaveLength(3);
    expect(categories[0]!.year).toBe(2025);
    expect(categories[0]!.url).toBe(
      "https://www.town.ranzan.saitama.jp/category/2-19-9-18-0-0-0-0-0-0.html",
    );
    expect(categories[1]!.year).toBe(2024);
    expect(categories[2]!.year).toBe(2023);
  });

  it("令和元年のカテゴリ URL を正しく処理する", () => {
    const html = `
      <h2><a href="../category/2-19-9-5-0-0-0-0-0-0.html">平成31年・令和元年</a></h2>
    `;

    const categories = parseCategoryUrls(html);

    // 令和元年 → 2019
    expect(categories.some((c) => c.year === 2019)).toBe(true);
  });

  it("重複するカテゴリ URL は一度だけ返す", () => {
    const html = `
      <a href="../category/2-19-9-17-0-0-0-0-0-0.html">令和6年</a>
      <a href="../category/2-19-9-17-0-0-0-0-0-0.html">令和6年（再掲）</a>
    `;

    const categories = parseCategoryUrls(html);

    expect(categories).toHaveLength(1);
  });

  it("カテゴリ URL でないリンクはスキップする", () => {
    const html = `
      <a href="/index.html">トップページ</a>
      <a href="../category/2-19-9-17-0-0-0-0-0-0.html">令和6年</a>
      <a href="/other/page.html">その他</a>
    `;

    const categories = parseCategoryUrls(html);

    expect(categories).toHaveLength(1);
  });
});

describe("parseArticleUrls", () => {
  it("個別会議録ページの URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.ranzan.saitama.jp/0000007843.html">決算審査特別委員会会議録</a></li>
        <li><a href="https://www.town.ranzan.saitama.jp/0000007842.html">第3回定例会</a></li>
        <li><a href="https://www.town.ranzan.saitama.jp/0000007841.html">予算特別委員会会議録</a></li>
      </ul>
    `;

    const articles = parseArticleUrls(html);

    expect(articles).toHaveLength(3);
    expect(articles[0]!.url).toBe(
      "https://www.town.ranzan.saitama.jp/0000007843.html",
    );
    expect(articles[0]!.title).toBe("決算審査特別委員会会議録");
    expect(articles[1]!.url).toBe(
      "https://www.town.ranzan.saitama.jp/0000007842.html",
    );
    expect(articles[1]!.title).toBe("第3回定例会");
  });

  it("重複する URL は一度だけ返す", () => {
    const html = `
      <a href="https://www.town.ranzan.saitama.jp/0000007843.html">決算審査特別委員会会議録</a>
      <a href="https://www.town.ranzan.saitama.jp/0000007843.html">決算審査特別委員会会議録（再掲）</a>
    `;

    const articles = parseArticleUrls(html);

    expect(articles).toHaveLength(1);
  });

  it("タイトルが空のリンクはスキップする", () => {
    const html = `
      <a href="https://www.town.ranzan.saitama.jp/0000007843.html"></a>
      <a href="https://www.town.ranzan.saitama.jp/0000007842.html">第3回定例会</a>
    `;

    const articles = parseArticleUrls(html);

    expect(articles).toHaveLength(1);
    expect(articles[0]!.title).toBe("第3回定例会");
  });

  it("嵐山町ドメイン以外のリンクはスキップする", () => {
    const html = `
      <a href="https://www.example.com/0000007843.html">外部リンク</a>
      <a href="https://www.town.ranzan.saitama.jp/0000007842.html">第3回定例会</a>
    `;

    const articles = parseArticleUrls(html);

    expect(articles).toHaveLength(1);
    expect(articles[0]!.title).toBe("第3回定例会");
  });
});

describe("parsePdfUrl", () => {
  it("cmsfiles を含む PDF URL を抽出する", () => {
    const html = `
      <a href="./cmsfiles/contents/0000007/7843/R0709K.pdf">
        <img src="images/pdf.gif"> 令和7年決算審査特別委員会会議録 (PDF形式、2.66MB)
      </a>
    `;

    const url = parsePdfUrl(html);

    expect(url).toBe(
      "https://www.town.ranzan.saitama.jp/cmsfiles/contents/0000007/7843/R0709K.pdf",
    );
  });

  it("絶対 URL の PDF リンクをそのまま返す", () => {
    const html = `
      <a href="https://www.town.ranzan.saitama.jp/cmsfiles/contents/0000007/7842/R0709T.pdf">
        第3回定例会会議録 (PDF形式、3.5MB)
      </a>
    `;

    const url = parsePdfUrl(html);

    expect(url).toBe(
      "https://www.town.ranzan.saitama.jp/cmsfiles/contents/0000007/7842/R0709T.pdf",
    );
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `
      <div>会議録はありません</div>
    `;

    const url = parsePdfUrl(html);

    expect(url).toBeNull();
  });
});

describe("buildHeldOn", () => {
  it("R0709K.pdf → 2025-09-01", () => {
    expect(buildHeldOn("https://example.com/R0709K.pdf", 2025)).toBe(
      "2025-09-01",
    );
  });

  it("R0603T.pdf → 2024-03-01", () => {
    expect(buildHeldOn("https://example.com/R0603T.pdf", 2024)).toBe(
      "2024-03-01",
    );
  });

  it("R0712T.pdf → 2025-12-01", () => {
    expect(buildHeldOn("https://example.com/R0712T.pdf", 2025)).toBe(
      "2025-12-01",
    );
  });

  it("ファイル名パターンに合致しない場合は null を返す", () => {
    expect(buildHeldOn("https://example.com/document.pdf", 2024)).toBeNull();
  });
});
