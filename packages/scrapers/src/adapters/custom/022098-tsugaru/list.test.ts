import { describe, expect, it } from "vitest";
import {
  parseYearPageLinks,
  extractYearFromTitle,
  parseYearPage,
} from "./list";

describe("parseYearPageLinks", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/shigikai/kaigiroku/10069.html">令和7年分</a></li>
        <li><a href="/soshiki/shigikai/kaigiroku/9499.html">令和6年分</a></li>
        <li><a href="/soshiki/shigikai/kaigiroku/8133.html">令和5年分</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(
      "https://www.city.tsugaru.aomori.jp/soshiki/shigikai/kaigiroku/10069.html"
    );
    expect(result[1]).toBe(
      "https://www.city.tsugaru.aomori.jp/soshiki/shigikai/kaigiroku/9499.html"
    );
  });

  it("index.html へのリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/shigikai/kaigiroku/index.html">会議録トップ</a></li>
        <li><a href="/soshiki/shigikai/kaigiroku/10069.html">令和7年分</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toContain("10069.html");
  });

  it("年度別ページへのリンクがない場合は空配列を返す", () => {
    const html = "<p>リンクなし</p>";
    expect(parseYearPageLinks(html)).toEqual([]);
  });

  it("絶対 URL はそのまま返す", () => {
    const html = `
      <a href="https://www.city.tsugaru.aomori.jp/soshiki/shigikai/kaigiroku/10069.html">令和7年</a>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.city.tsugaru.aomori.jp/soshiki/shigikai/kaigiroku/10069.html"
    );
  });
});

describe("extractYearFromTitle", () => {
  it("令和年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和7年第1回定例会本会議")).toBe(2025);
    expect(extractYearFromTitle("令和6年第4回定例会本会議")).toBe(2024);
    expect(extractYearFromTitle("令和元年第1回定例会本会議")).toBe(2019);
  });

  it("平成年を西暦に変換する", () => {
    expect(extractYearFromTitle("平成25年第1回定例会本会議")).toBe(2013);
    expect(extractYearFromTitle("平成30年第2回定例会本会議")).toBe(2018);
  });

  it("全角数字を含む場合も変換できる", () => {
    expect(extractYearFromTitle("令和７年第１回定例会本会議")).toBe(2025);
  });

  it("年号がない場合は null を返す", () => {
    expect(extractYearFromTitle("第1回定例会本会議")).toBeNull();
    expect(extractYearFromTitle("")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("指定年の PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/27/R0703teireikai.pdf">令和7年第1回定例会本会議(PDFファイル: 1.9MB)</a></li>
        <li><a href="/material/files/group/27/R0706teireikai.pdf">令和7年第2回定例会本会議(PDFファイル: 2.1MB)</a></li>
      </ul>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和7年第1回定例会本会議");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.tsugaru.aomori.jp/material/files/group/27/R0703teireikai.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.heldOn).toBeNull();
  });

  it("臨時会を extraordinary として分類する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/27/R0701rinnjikai.pdf">令和7年第1回臨時会本会議(PDFファイル: 0.5MB)</a></li>
      </ul>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("委員会を committee として分類する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/27/R0703yosanntokubetuiinnkai.pdf">令和7年第1回定例会予算特別委員会(PDFファイル: 1.2MB)</a></li>
      </ul>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("committee");
  });

  it("指定年以外のリンクをスキップする", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/27/R0703teireikai.pdf">令和7年第1回定例会本会議</a></li>
        <li><a href="/material/files/group/27/R0603teireikai.pdf">令和6年第1回定例会本会議</a></li>
      </ul>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
  });

  it("PDFファイルサイズの表記を除去してタイトルを取得する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/27/R0703teireikai.pdf">令和7年第1回定例会本会議(PDFファイル: 1.9MB)</a></li>
      </ul>
    `;

    const result = parseYearPage(html, 2025);

    expect(result[0]!.title).toBe("令和7年第1回定例会本会議");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(parseYearPage(html, 2025)).toEqual([]);
  });

  it("絶対 URL の PDF リンクもそのまま取得する", () => {
    const html = `
      <ul>
        <li><a href="https://www.city.tsugaru.aomori.jp/material/files/group/27/R0703teireikai.pdf">令和7年第1回定例会本会議</a></li>
      </ul>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.tsugaru.aomori.jp/material/files/group/27/R0703teireikai.pdf"
    );
  });
});
