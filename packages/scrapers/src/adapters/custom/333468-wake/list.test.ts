import { describe, expect, it } from "vitest";
import {
  convertHeadingToWesternYear,
  detectMeetingType,
  toHalfWidth,
} from "./shared";
import { parseListPage } from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和７年")).toBe("令和7年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertHeadingToWesternYear", () => {
  it("令和の半角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和7年")).toBe(2025);
    expect(convertHeadingToWesternYear("令和6年")).toBe(2024);
  });

  it("令和の全角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和７年")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(convertHeadingToWesternYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertHeadingToWesternYear("平成28年")).toBe(2016);
    expect(convertHeadingToWesternYear("平成30年")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertHeadingToWesternYear("会議録一覧")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("令和7年 第7回12月定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("令和6年 第1回1月臨時会")).toBe("extraordinary");
  });

  it("委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("令和6年 予算審査特別委員会")).toBe("committee");
  });
});

describe("parseListPage", () => {
  it("実際のHTML構造から年・会議・PDFリンクを抽出する（プロトコル省略形式）", () => {
    // 和気町の実際のHTML形式: href="//www.town.wake.lg.jp/material/files/group/14/{ID}.pdf"
    const html = `
      <ul>
        <li><a href="//www.town.wake.lg.jp/material/files/group/14/803102.pdf">令和7年 第7回12月定例会 (PDFファイル: 1.1MB)</a></li>
        <li><a href="//www.town.wake.lg.jp/material/files/group/14/706041.pdf">令和6年 第6回12月定例会 (PDFファイル: 1.2MB)</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.headingYear).toBe(2025);
    expect(result[0]!.title).toBe("令和7年 第7回12月定例会");
    expect(result[0]!.pdfUrl).toBe("https://www.town.wake.lg.jp/material/files/group/14/803102.pdf");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.headingYear).toBe(2024);
    expect(result[1]!.title).toBe("令和6年 第6回12月定例会");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/14/600001.pdf">令和6年 第1回1月臨時会 (PDFファイル: 149.1KB)</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.title).toBe("令和6年 第1回1月臨時会");
  });

  it("平成の年度を正しく変換する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/14/29527.pdf">平成30年 第1回3月定例会 (PDFファイル: 1.2MB)</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.headingYear).toBe(2018);
    expect(result[0]!.title).toBe("平成30年 第1回3月定例会");
  });

  it("プロトコル省略形式のURLに対応する", () => {
    const html = `
      <ul>
        <li><a href="//www.town.wake.lg.jp/material/files/group/14/803102.pdf">令和7年 第7回12月定例会 (PDFファイル: 1.1MB)</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe("https://www.town.wake.lg.jp/material/files/group/14/803102.pdf");
  });

  it("PDFファイルサイズ表記を除去してタイトルを整形する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/14/803102.pdf">令和7年 第7回12月定例会 (PDFファイル: 1.1MB)</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年 第7回12月定例会");
  });

  it("/material/files/group/14/ 以外のPDFリンクは収集しない", () => {
    const html = `
      <ul>
        <li><a href="/other/path/file.pdf">外部PDF</a></li>
        <li><a href="/material/files/group/14/803102.pdf">令和7年 第7回12月定例会 (PDFファイル: 1.1MB)</a></li>
      </ul>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe("https://www.town.wake.lg.jp/material/files/group/14/803102.pdf");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("年度情報のないPDFリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/14/803102.pdf">会議録 (PDFファイル: 1.1MB)</a></li>
      </ul>
    `;

    const result = parseListPage(html);
    expect(result).toEqual([]);
  });
});
