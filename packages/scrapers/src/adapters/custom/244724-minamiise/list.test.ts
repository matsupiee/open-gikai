import { describe, expect, it } from "vitest";
import { toListRecord } from "./list";
import {
  parseWarekiYear,
  detectMeetingType,
  extractYearLinks,
  extractPdfLinks,
} from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年")).toBe(2024);
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和3年")).toBe(2021);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年（平成31年）")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成28年")).toBe(2016);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("第1回定例会")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("第1回定例会審議結果")).toBe("plenary");
    expect(detectMeetingType("第4回定例会一般質問事項")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第1回臨時会審議結果")).toBe("extraordinary");
    expect(detectMeetingType("第2回臨時会審議結果")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務常任委員会")).toBe("committee");
  });

  it("委員会付託は定例会として扱う", () => {
    expect(detectMeetingType("第2回定例会委員会付託")).toBe("plenary");
  });
});

describe("extractYearLinks", () => {
  it("ippanセクションの年度別リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/admin/shoshiki/gikaijimu/ippan/6559.html">令和6年</a></li>
        <li><a href="/admin/shoshiki/gikaijimu/ippan/5566.html">令和5年</a></li>
        <li><a href="/admin/shoshiki/gikaijimu/ippan/4795.html">令和4年</a></li>
        <li><a href="/admin/shoshiki/gikaijimu/ippan/2498.html">令和元年（平成31年）</a></li>
      </ul>
    `;

    const result = extractYearLinks(html, "ippan");

    expect(result).toHaveLength(4);
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.url).toBe(
      "https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/ippan/6559.html"
    );
    expect(result[1]!.year).toBe(2023);
    expect(result[2]!.year).toBe(2022);
    expect(result[3]!.year).toBe(2019);
  });

  it("shingikekkaセクションの年度別リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/admin/shoshiki/gikaijimu/shingikekka/6475.html">令和6年</a></li>
        <li><a href="/admin/shoshiki/gikaijimu/shingikekka/5479.html">令和5年</a></li>
      </ul>
    `;

    const result = extractYearLinks(html, "shingikekka");

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.url).toBe(
      "https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/shingikekka/6475.html"
    );
  });

  it("他のセクションのリンクは除外する", () => {
    const html = `
      <ul>
        <li><a href="/admin/shoshiki/gikaijimu/ippan/6559.html">令和6年</a></li>
        <li><a href="/admin/shoshiki/gikaijimu/shingikekka/6475.html">令和6年</a></li>
        <li><a href="/admin/shoshiki/gikaijimu/iinkai/index.html">委員会について</a></li>
      </ul>
    `;

    const result = extractYearLinks(html, "ippan");

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toContain("/ippan/");
  });

  it("同じ年度が複数ある場合は最初のものを優先する", () => {
    const html = `
      <ul>
        <li><a href="/admin/shoshiki/gikaijimu/ippan/6559.html">令和6年</a></li>
        <li><a href="/admin/shoshiki/gikaijimu/ippan/9999.html">令和6年</a></li>
      </ul>
    `;

    const result = extractYearLinks(html, "ippan");

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toContain("6559.html");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<div><p>準備中</p></div>";
    expect(extractYearLinks(html, "ippan")).toEqual([]);
  });
});

describe("extractPdfLinks", () => {
  it("プロトコル相対URLのPDFリンクを絶対URLに変換して抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="//www.town.minamiise.lg.jp/material/files/group/16/R6_3_ippansitumon.pdf">
            第1回定例会一般質問事項 (PDFファイル: 72.6KB)
          </a>
        </li>
        <li>
          <a href="//www.town.minamiise.lg.jp/material/files/group/16/reiwarokunenndainikaiteireikaiippannshitumonn.pdf">
            第2回定例会一般質問事項 (PDFファイル: 101.8KB)
          </a>
        </li>
      </ul>
    `;

    const result = extractPdfLinks(
      html,
      "https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/ippan/6559.html"
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("第1回定例会一般質問事項");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.minamiise.lg.jp/material/files/group/16/R6_3_ippansitumon.pdf"
    );
    expect(result[1]!.title).toBe("第2回定例会一般質問事項");
  });

  it("ファイルサイズ表記を除去してタイトルを整形する", () => {
    const html = `
      <a href="//www.town.minamiise.lg.jp/material/files/group/16/R6_1_rinjikai_kekka.pdf">
        第1回臨時会審議結果 (PDFファイル: 65.1KB)
      </a>
    `;

    const result = extractPdfLinks(
      html,
      "https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/shingikekka/6475.html"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回臨時会審議結果");
  });

  it("相対パスのPDFリンクもベースURLで解決する", () => {
    const html = `
      <a href="/material/files/group/16/sample.pdf">サンプル</a>
    `;

    const result = extractPdfLinks(
      html,
      "https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/ippan/6559.html"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.minamiise.lg.jp/material/files/group/16/sample.pdf"
    );
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<div><p>準備中です。</p></div>";
    const result = extractPdfLinks(
      html,
      "https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/ippan/6559.html"
    );
    expect(result).toEqual([]);
  });
});

describe("toListRecord", () => {
  it("MinamiisePdfRecord を ListRecord に変換する", () => {
    const record = {
      title: "第1回定例会一般質問事項",
      meetingType: "plenary",
      pdfUrl: "https://www.town.minamiise.lg.jp/material/files/group/16/R6_3_ippansitumon.pdf",
      year: 2024,
      kind: "ippan" as const,
      yearPageUrl:
        "https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/ippan/6559.html",
    };

    const result = toListRecord(record);

    expect(result.detailParams["title"]).toBe("第1回定例会一般質問事項");
    expect(result.detailParams["meetingType"]).toBe("plenary");
    expect(result.detailParams["pdfUrl"]).toBe(
      "https://www.town.minamiise.lg.jp/material/files/group/16/R6_3_ippansitumon.pdf"
    );
    expect(result.detailParams["year"]).toBe(2024);
    expect(result.detailParams["kind"]).toBe("ippan");
    expect(result.detailParams["yearPageUrl"]).toBe(
      "https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/ippan/6559.html"
    );
  });
});
