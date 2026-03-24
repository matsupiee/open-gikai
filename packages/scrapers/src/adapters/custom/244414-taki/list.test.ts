import { describe, expect, it } from "vitest";
import { toListRecord } from "./list";
import {
  parseWarekiYear,
  detectMeetingType,
  extractYearLinks,
  extractPdfLinks,
  extractSessionNumber,
} from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和5年")).toBe(2023);
    expect(parseWarekiYear("令和6年")).toBe(2024);
    expect(parseWarekiYear("令和7年")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年")).toBe(2019);
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
  it("一般質問はplenaryを返す", () => {
    expect(detectMeetingType("令和6年第4回定例会一般質問")).toBe("plenary");
    expect(detectMeetingType("令和5年第1回 多気町議会定例会一般質問")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務常任委員会")).toBe("committee");
  });

  it("委員会付託は定例会として扱う", () => {
    expect(detectMeetingType("第2回定例会委員会付託")).toBe("plenary");
  });
});

describe("extractYearLinks", () => {
  it("kaigirokuセクションの年度別リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/life/soshiki/gikai_jimukyoku/kaigiroku/4784.html">令和7年</a></li>
        <li><a href="/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html">令和6年</a></li>
        <li><a href="/life/soshiki/gikai_jimukyoku/kaigiroku/3238.html">令和5年</a></li>
      </ul>
    `;

    const result = extractYearLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.url).toBe(
      "https://www.town.taki.mie.jp/life/soshiki/gikai_jimukyoku/kaigiroku/4784.html"
    );
    expect(result[1]!.year).toBe(2024);
    expect(result[1]!.url).toBe(
      "https://www.town.taki.mie.jp/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html"
    );
    expect(result[2]!.year).toBe(2023);
  });

  it("index.htmlは除外する", () => {
    const html = `
      <ul>
        <li><a href="/life/soshiki/gikai_jimukyoku/kaigiroku/index.html">会議録一覧</a></li>
        <li><a href="/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html">令和6年</a></li>
      </ul>
    `;

    const result = extractYearLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2024);
  });

  it("他のセクションのリンクは除外する", () => {
    const html = `
      <ul>
        <li><a href="/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html">令和6年</a></li>
        <li><a href="/life/soshiki/gikai_jimukyoku/teireikai/3646.html">令和6年定例会</a></li>
      </ul>
    `;

    const result = extractYearLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toContain("/kaigiroku/");
  });

  it("同じ年度が複数ある場合は最初のものを優先する", () => {
    const html = `
      <ul>
        <li><a href="/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html">令和6年</a></li>
        <li><a href="/life/soshiki/gikai_jimukyoku/kaigiroku/9999.html">令和6年</a></li>
      </ul>
    `;

    const result = extractYearLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toContain("4031.html");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<div><p>準備中</p></div>";
    expect(extractYearLinks(html)).toEqual([]);
  });
});

describe("extractPdfLinks", () => {
  it("プロトコル相対URLのPDFリンクを絶対URLに変換して抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="//www.town.taki.mie.jp/material/files/group/14/HPR79ippan.pdf">
            令和7年第9月定例会一般質問 (PDFファイル: 500KB)
          </a>
        </li>
        <li>
          <a href="//www.town.taki.mie.jp/material/files/group/14/R612ippan.pdf">
            令和6年第4回定例会一般質問 (PDFファイル: 450KB)
          </a>
        </li>
      </ul>
    `;

    const result = extractPdfLinks(
      html,
      "https://www.town.taki.mie.jp/life/soshiki/gikai_jimukyoku/kaigiroku/4784.html"
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和7年第9月定例会一般質問");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.taki.mie.jp/material/files/group/14/HPR79ippan.pdf"
    );
    expect(result[1]!.title).toBe("令和6年第4回定例会一般質問");
  });

  it("ファイルサイズ表記を除去してタイトルを整形する", () => {
    const html = `
      <a href="//www.town.taki.mie.jp/material/files/group/14/giziroku060611.pdf">
        令和6年第2回定例会一般質問 (PDFファイル: 350KB)
      </a>
    `;

    const result = extractPdfLinks(
      html,
      "https://www.town.taki.mie.jp/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年第2回定例会一般質問");
  });

  it("相対パスのPDFリンクもベースURLで解決する", () => {
    const html = `
      <a href="/material/files/group/14/sample.pdf">サンプル</a>
    `;

    const result = extractPdfLinks(
      html,
      "https://www.town.taki.mie.jp/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.taki.mie.jp/material/files/group/14/sample.pdf"
    );
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<div><p>準備中です。</p></div>";
    const result = extractPdfLinks(
      html,
      "https://www.town.taki.mie.jp/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html"
    );
    expect(result).toEqual([]);
  });
});

describe("extractSessionNumber", () => {
  it("第N回の回数を抽出する", () => {
    expect(extractSessionNumber("令和6年第4回定例会一般質問")).toBe(4);
    expect(extractSessionNumber("令和5年第1回 多気町議会定例会一般質問")).toBe(1);
    expect(extractSessionNumber("令和7年第2回多気町議会定例会（一般質問）")).toBe(2);
  });

  it("回数がない場合はnullを返す", () => {
    expect(extractSessionNumber("令和6年多気町議会定例会一般質問")).toBeNull();
    expect(extractSessionNumber("")).toBeNull();
  });
});

describe("toListRecord", () => {
  it("TakiPdfRecord を ListRecord に変換する", () => {
    const record = {
      title: "令和6年第4回定例会一般質問",
      meetingType: "plenary",
      pdfUrl: "https://www.town.taki.mie.jp/material/files/group/14/R612ippan.pdf",
      year: 2024,
      sessionNumber: 4,
      yearPageUrl:
        "https://www.town.taki.mie.jp/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html",
    };

    const result = toListRecord(record);

    expect(result.detailParams["title"]).toBe("令和6年第4回定例会一般質問");
    expect(result.detailParams["meetingType"]).toBe("plenary");
    expect(result.detailParams["pdfUrl"]).toBe(
      "https://www.town.taki.mie.jp/material/files/group/14/R612ippan.pdf"
    );
    expect(result.detailParams["year"]).toBe(2024);
    expect(result.detailParams["sessionNumber"]).toBe(4);
    expect(result.detailParams["yearPageUrl"]).toBe(
      "https://www.town.taki.mie.jp/life/soshiki/gikai_jimukyoku/kaigiroku/4031.html"
    );
  });
});
