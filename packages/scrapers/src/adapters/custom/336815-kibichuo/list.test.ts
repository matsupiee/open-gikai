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
    expect(toHalfWidth("令和６年")).toBe("令和6年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertHeadingToWesternYear", () => {
  it("西暦年（2024年(令和6年)形式）を変換する", () => {
    expect(convertHeadingToWesternYear("2024年(令和6年)")).toBe(2024);
    expect(convertHeadingToWesternYear("2025年（令和7年）")).toBe(2025);
  });

  it("令和の全角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和６年")).toBe(2024);
    expect(convertHeadingToWesternYear("令和７年")).toBe(2025);
  });

  it("令和の半角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和6年")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(convertHeadingToWesternYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertHeadingToWesternYear("平成30年")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertHeadingToWesternYear("会議録一覧")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("第6回12月定例会 1日目")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("第2回5月臨時会 1日目")).toBe("extraordinary");
  });

  it("委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("予算審査特別委員会 1日目")).toBe("committee");
  });
});

describe("parseListPage", () => {
  it("実際のHTML構造から年・会議・PDFリンクを抽出する", () => {
    const html = `
      <p><strong>2024年(令和6年)</strong></p>
      <p>・第6回12月定例会　<a href="/uploaded/attachment/11548.pdf">一般質問概要書 [PDFファイル／360KB]</a></p>
      <p>　<a href="/uploaded/attachment/11549.pdf">1日目 [PDFファイル／362KB]</a></p>
      <p>　<a href="/uploaded/attachment/11550.pdf">2日目 [PDFファイル／957KB]</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.headingYear).toBe(2024);
    expect(result[0]!.title).toBe("第6回12月定例会 1日目");
    expect(result[0]!.pdfUrl).toBe("https://www.town.kibichuo.lg.jp/uploaded/attachment/11549.pdf");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.title).toBe("第6回12月定例会 2日目");
  });

  it("一般質問概要書をスキップする", () => {
    const html = `
      <p><strong>2024年(令和6年)</strong></p>
      <p>・第1回3月定例会　<a href="/uploaded/attachment/10370.pdf">一般質問概要書 [PDFファイル／99KB]</a></p>
      <p>　<a href="/uploaded/attachment/10371.pdf">1日目 [PDFファイル／550KB]</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回3月定例会 1日目");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <p><strong>2024年(令和6年)</strong></p>
      <p>・第5回10月臨時会　<a href="/uploaded/attachment/11373.pdf">10月24日[PDFファイル／574KB]</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.title).toBe("第5回10月臨時会 10月24日");
  });

  it("複数年度のリンクを正しく紐付ける", () => {
    const html = `
      <p><strong>2024年(令和6年)</strong></p>
      <p>・第6回12月定例会　<a href="/uploaded/attachment/11548.pdf">一般質問概要書 [PDFファイル／360KB]</a></p>
      <p>　<a href="/uploaded/attachment/11549.pdf">1日目 [PDFファイル／362KB]</a></p>
      <p><strong>2023年(令和5年)</strong></p>
      <p>・第4回9月定例会　<a href="/uploaded/attachment/9491.pdf">一般質問概要書 [PDFファイル／93KB]</a></p>
      <p>　<a href="/uploaded/attachment/9492.pdf">1日目 [PDFファイル／433KB]</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.headingYear).toBe(2024);
    expect(result[0]!.title).toBe("第6回12月定例会 1日目");
    expect(result[1]!.headingYear).toBe(2023);
    expect(result[1]!.title).toBe("第4回9月定例会 1日目");
  });

  it("PDFファイルサイズ表記を除去してタイトルを整形する", () => {
    const html = `
      <p><strong>2024年(令和6年)</strong></p>
      <p>・第1回3月定例会　<a href="/uploaded/attachment/10370.pdf">一般質問概要書 [PDFファイル／99KB]</a></p>
      <p>　<a href="/uploaded/attachment/10371.pdf">1日目 [PDFファイル／550KB]</a></p>
      <p>　<a href="/uploaded/attachment/10372.pdf">2日目 [PDFファイル／205KB]</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("第1回3月定例会 1日目");
    expect(result[1]!.title).toBe("第1回3月定例会 2日目");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("/uploaded/attachment/ 以外のPDFリンクは収集しない", () => {
    const html = `
      <p><strong>2024年(令和6年)</strong></p>
      <p>・第1回3月定例会</p>
      <a href="/other/path/file.pdf">外部PDF</a>
      <p>　<a href="/uploaded/attachment/12345.pdf">1日目 [PDFファイル／500KB]</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe("https://www.town.kibichuo.lg.jp/uploaded/attachment/12345.pdf");
  });
});
