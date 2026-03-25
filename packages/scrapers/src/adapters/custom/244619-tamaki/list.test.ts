import { describe, expect, it } from "vitest";
import { toListRecord } from "./list";
import {
  parseWarekiYear,
  detectMeetingType,
  extractYearlyTocLinks,
  extractPdfLinks,
} from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年")).toBe(2024);
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和3年")).toBe(2021);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成19年")).toBe(2007);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("第1回定例会")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和6年第1回定例会")).toBe("plenary");
    expect(detectMeetingType("令和6年第4回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和6年臨時会")).toBe("extraordinary");
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("予算決算常任委員会")).toBe("committee");
    expect(detectMeetingType("総務産業常任委員会")).toBe("committee");
    expect(detectMeetingType("教育民生常任委員会")).toBe("committee");
  });

  it("委員会付託は定例会として扱う", () => {
    expect(detectMeetingType("第2回定例会委員会付託")).toBe("plenary");
  });
});

describe("extractYearlyTocLinks", () => {
  it("年度別目次リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="2024-0603-0855-10.html">令和6年</a></li>
        <li><a href="2023-0718-1309-11.html">令和5年</a></li>
        <li><a href="r4.html">令和4年</a></li>
        <li><a href="r3.html">令和3年</a></li>
      </ul>
    `;

    const result = extractYearlyTocLinks(html);

    expect(result).toHaveLength(4);
    expect(result[0]!.url).toBe(
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/2024-0603-0855-10.html"
    );
    expect(result[1]!.url).toBe(
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/2023-0718-1309-11.html"
    );
    expect(result[2]!.url).toBe(
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/r4.html"
    );
  });

  it("gijiroku.htmlへの自己参照リンクは除外する", () => {
    const html = `
      <ul>
        <li><a href="gijiroku.html">議事録一覧</a></li>
        <li><a href="r4.html">令和4年</a></li>
      </ul>
    `;

    const result = extractYearlyTocLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toContain("r4.html");
  });

  it("BASE_URL外のリンクは除外する", () => {
    const html = `
      <ul>
        <li><a href="https://external.example.com/page.html">外部リンク</a></li>
        <li><a href="r4.html">令和4年</a></li>
      </ul>
    `;

    const result = extractYearlyTocLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toContain("r4.html");
  });

  it("重複URLは除外する", () => {
    const html = `
      <ul>
        <li><a href="r4.html">令和4年</a></li>
        <li><a href="r4.html">令和4年（再掲）</a></li>
      </ul>
    `;

    const result = extractYearlyTocLinks(html);

    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<div><p>準備中</p></div>";
    expect(extractYearlyTocLinks(html)).toEqual([]);
  });
});

describe("extractPdfLinks", () => {
  it("documents/配下のPDFリンクを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="documents/061210jyoutei.pdf">令和6年12月定例会（上程）</a>
        </li>
        <li>
          <a href="documents/061211situmonn.pdf">令和6年12月定例会（一般質問）</a>
        </li>
      </ul>
    `;

    const pageUrl =
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/2024-0603-0855-10.html";
    const result = extractPdfLinks(html, pageUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和6年12月定例会（上程）");
    expect(result[0]!.pdfUrl).toBe(
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/documents/061210jyoutei.pdf"
    );
    expect(result[1]!.title).toBe("令和6年12月定例会（一般質問）");
  });

  it("絶対パスのPDFリンクも取得できる", () => {
    const html = `
      <a href="https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/documents/060701rinnji.pdf">令和6年臨時会</a>
    `;

    const pageUrl =
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/r4.html";
    const result = extractPdfLinks(html, pageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年臨時会");
    expect(result[0]!.pdfUrl).toBe(
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/documents/060701rinnji.pdf"
    );
  });

  it("documents/以外のPDFリンクは除外する", () => {
    const html = `
      <a href="other/file.pdf">その他ファイル</a>
      <a href="documents/valid.pdf">有効なファイル</a>
    `;

    const pageUrl =
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/r4.html";
    const result = extractPdfLinks(html, pageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("documents/valid.pdf");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<div><p>準備中です。</p></div>";
    const pageUrl =
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/r4.html";
    expect(extractPdfLinks(html, pageUrl)).toEqual([]);
  });
});

describe("toListRecord", () => {
  it("TamakiPdfRecord を ListRecord に変換する", () => {
    const record = {
      title: "令和6年12月定例会（上程）",
      meetingType: "plenary",
      pdfUrl:
        "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/documents/061210jyoutei.pdf",
      year: 2024,
      tocPageUrl:
        "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/2024-0603-0855-10.html",
    };

    const result = toListRecord(record);

    expect(result.detailParams["title"]).toBe("令和6年12月定例会（上程）");
    expect(result.detailParams["meetingType"]).toBe("plenary");
    expect(result.detailParams["pdfUrl"]).toBe(
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/documents/061210jyoutei.pdf"
    );
    expect(result.detailParams["year"]).toBe(2024);
    expect(result.detailParams["tocPageUrl"]).toBe(
      "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/2024-0603-0855-10.html"
    );
  });
});
