import { describe, expect, it } from "vitest";
import {
  parseYearListPage,
  parseDetailPage,
  parseTitleFromDetailPage,
  parseYearFromTitle,
  detectCategoryFromTitle,
} from "./list";

describe("parseYearListPage", () => {
  it("会議録リンクを抽出する", () => {
    const html = `
      <html><body>
      <ul>
        <li><a href="kaigiroku1.html">令和7年第7回定例会会議録</a></li>
        <li><a href="kaigiroku2.html">令和7年第6回定例会会議録</a></li>
        <li><a href="giketu1.html">令和7年第7回定例会議決案</a></li>
        <li><a href="kaiki1.html">令和7年第7回定例会会期日程</a></li>
      </ul>
      </body></html>
    `;

    const baseUrl =
      "https://www.vill.tokashiki.okinawa.jp/gyoseijoho/tokashikisongikai/1/reiwa7/index.html";
    const urls = parseYearListPage(html, baseUrl);

    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("kaigiroku1.html");
    expect(urls[1]).toContain("kaigiroku2.html");
  });

  it("「会議録」を含まないリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="giketu.html">議決案</a></li>
        <li><a href="kaiki.html">会期日程</a></li>
        <li><a href="yobo.html">要望決議</a></li>
      </ul>
    `;

    const baseUrl =
      "https://www.vill.tokashiki.okinawa.jp/gyoseijoho/tokashikisongikai/1/reiwa7/index.html";
    const urls = parseYearListPage(html, baseUrl);
    expect(urls).toHaveLength(0);
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="kaigiroku1.html">令和7年第7回定例会会議録</a></li>
        <li><a href="kaigiroku1.html">令和7年第7回定例会会議録</a></li>
      </ul>
    `;

    const baseUrl =
      "https://www.vill.tokashiki.okinawa.jp/gyoseijoho/tokashikisongikai/1/reiwa7/index.html";
    const urls = parseYearListPage(html, baseUrl);
    expect(urls).toHaveLength(1);
  });

  it(".pdf リンクを除外する（個別ページではなく直接 PDF）", () => {
    const html = `
      <ul>
        <li><a href="//www.vill.tokashiki.okinawa.jp/material/files/group/7/reiwa7_12kaigiroku.pdf">会議録PDF</a></li>
      </ul>
    `;

    const baseUrl =
      "https://www.vill.tokashiki.okinawa.jp/gyoseijoho/tokashikisongikai/1/reiwa7/index.html";
    const urls = parseYearListPage(html, baseUrl);
    expect(urls).toHaveLength(0);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;
    const baseUrl =
      "https://www.vill.tokashiki.okinawa.jp/gyoseijoho/tokashikisongikai/1/reiwa7/index.html";
    const urls = parseYearListPage(html, baseUrl);
    expect(urls).toHaveLength(0);
  });
});

describe("parseDetailPage", () => {
  it("プロトコル相対 URL の PDF リンクを抽出する", () => {
    const html = `
      <html><body>
      <h1>令和7年第7回定例会会議録</h1>
      <p>
        <a href="//www.vill.tokashiki.okinawa.jp/material/files/group/7/reiwa7_12kaigiroku.pdf">
          会議録PDF (1.2MB)
        </a>
      </p>
      </body></html>
    `;

    const result = parseDetailPage(html);

    expect(result).not.toBeNull();
    expect(result!.pdfUrl).toBe(
      "https://www.vill.tokashiki.okinawa.jp/material/files/group/7/reiwa7_12kaigiroku.pdf",
    );
    expect(result!.pdfKey).toBe("473537_reiwa7_12kaigiroku");
  });

  it("https:// の PDF リンクを抽出する", () => {
    const html = `
      <html><body>
      <a href="https://www.vill.tokashiki.okinawa.jp/material/files/group/7/reiwa7_3teireikai1.pdf">
        PDF
      </a>
      </body></html>
    `;

    const result = parseDetailPage(html);

    expect(result).not.toBeNull();
    expect(result!.pdfUrl).toBe(
      "https://www.vill.tokashiki.okinawa.jp/material/files/group/7/reiwa7_3teireikai1.pdf",
    );
    expect(result!.pdfKey).toBe("473537_reiwa7_3teireikai1");
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `
      <html><body>
      <h1>令和7年第7回定例会会議録</h1>
      <p>現在準備中です。</p>
      </body></html>
    `;

    const result = parseDetailPage(html);
    expect(result).toBeNull();
  });
});

describe("parseTitleFromDetailPage", () => {
  it("<h1> タグからタイトルを抽出する", () => {
    const html = `
      <html><body>
      <h1>令和7年第7回定例会会議録</h1>
      </body></html>
    `;

    expect(parseTitleFromDetailPage(html)).toBe("令和7年第7回定例会会議録");
  });

  it("<h2> タグからタイトルを抽出する（h1 がない場合）", () => {
    const html = `
      <html><body>
      <h2>令和6年第3回定例会会議録</h2>
      </body></html>
    `;

    expect(parseTitleFromDetailPage(html)).toBe("令和6年第3回定例会会議録");
  });

  it("<title> タグからタイトルを抽出する（h1/h2 がない場合）", () => {
    const html = `
      <html>
      <head><title>令和5年第2回臨時会会議録 | 渡嘉敷村</title></head>
      <body></body>
      </html>
    `;

    expect(parseTitleFromDetailPage(html)).toBe(
      "令和5年第2回臨時会会議録 | 渡嘉敷村",
    );
  });
});

describe("parseYearFromTitle", () => {
  it("令和7年（2025）をパースする", () => {
    expect(parseYearFromTitle("令和7年第7回定例会会議録")).toBe(2025);
  });

  it("令和6年（2024）をパースする", () => {
    expect(parseYearFromTitle("令和6年第3回定例会会議録")).toBe(2024);
  });

  it("全角数字をパースする", () => {
    expect(parseYearFromTitle("令和７年第７回定例会会議録")).toBe(2025);
  });

  it("年号が含まれない場合は null を返す", () => {
    expect(parseYearFromTitle("定例会会議録")).toBeNull();
  });
});

describe("detectCategoryFromTitle", () => {
  it("臨時会を extraordinary として検出する", () => {
    expect(detectCategoryFromTitle("令和7年第1回臨時会会議録")).toBe(
      "extraordinary",
    );
  });

  it("定例会を plenary として検出する", () => {
    expect(detectCategoryFromTitle("令和7年第7回定例会会議録")).toBe("plenary");
  });

  it("不明なタイトルは plenary として扱う", () => {
    expect(detectCategoryFromTitle("会議録")).toBe("plenary");
  });
});
