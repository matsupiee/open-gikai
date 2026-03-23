import { describe, expect, it } from "vitest";
import { parseYearPage } from "./list";
import { detectMeetingType, buildPdfBaseUrl } from "./shared";

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("3月定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("4月臨時会")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });

  it("不明な場合は plenary を返す", () => {
    expect(detectMeetingType("会議録")).toBe("plenary");
  });
});

describe("buildPdfBaseUrl", () => {
  it("p{数字} 形式のパスを変換する", () => {
    expect(buildPdfBaseUrl("/gikai/kaigiroku/p014488.html")).toBe(
      "https://www.city.awara.lg.jp/gikai/kaigiroku/p014488_d/fil/",
    );
  });

  it("{2桁年}kaigiroku 形式のパスを変換する", () => {
    expect(buildPdfBaseUrl("/gikai/kaigiroku/30kaigiroku.html")).toBe(
      "https://www.city.awara.lg.jp/gikai/kaigiroku/30kaigiroku_d/fil/",
    );
  });
});

describe("parseYearPage", () => {
  it("令和系ページから PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>第120回</td>
          <td>第121回</td>
          <td>第122回</td>
        </tr>
        <tr>
          <td><a href="./p014488_d/fil/120kaigiroku.pdf">3月定例会</a></td>
          <td><a href="./p014488_d/fil/121kaigiroku.pdf">4月臨時会</a></td>
          <td><a href="./p014488_d/fil/122kaigiroku.pdf">6月定例会</a></td>
        </tr>
      </table>
    `;

    const result = parseYearPage(html, "/gikai/kaigiroku/p014488.html");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "第120回 3月定例会",
      pdfUrl:
        "https://www.city.awara.lg.jp/gikai/kaigiroku/p014488_d/fil/120kaigiroku.pdf",
      meetingType: "plenary",
      pagePath: "/gikai/kaigiroku/p014488.html",
    });
    expect(result[1]).toEqual({
      title: "第121回 4月臨時会",
      pdfUrl:
        "https://www.city.awara.lg.jp/gikai/kaigiroku/p014488_d/fil/121kaigiroku.pdf",
      meetingType: "extraordinary",
      pagePath: "/gikai/kaigiroku/p014488.html",
    });
    expect(result[2]).toEqual({
      title: "第122回 6月定例会",
      pdfUrl:
        "https://www.city.awara.lg.jp/gikai/kaigiroku/p014488_d/fil/122kaigiroku.pdf",
      meetingType: "plenary",
      pagePath: "/gikai/kaigiroku/p014488.html",
    });
  });

  it("平成27〜30年形式のページから PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>第94回</td>
          <td>第95回</td>
        </tr>
        <tr>
          <td><a href="./30kaigiroku_d/fil/1.pdf">3月定例会</a></td>
          <td><a href="./30kaigiroku_d/fil/2.pdf">5月臨時会</a></td>
        </tr>
      </table>
    `;

    const result = parseYearPage(html, "/gikai/kaigiroku/30kaigiroku.html");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第94回 3月定例会",
      pdfUrl:
        "https://www.city.awara.lg.jp/gikai/kaigiroku/30kaigiroku_d/fil/1.pdf",
      meetingType: "plenary",
      pagePath: "/gikai/kaigiroku/30kaigiroku.html",
    });
    expect(result[1]).toEqual({
      title: "第95回 5月臨時会",
      pdfUrl:
        "https://www.city.awara.lg.jp/gikai/kaigiroku/30kaigiroku_d/fil/2.pdf",
      meetingType: "extraordinary",
      pagePath: "/gikai/kaigiroku/30kaigiroku.html",
    });
  });

  it("旧平成系ページから PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>第1回</td>
          <td>第2回</td>
        </tr>
        <tr>
          <td><a href="./p000958_d/fil/001.pdf">3月定例会</a></td>
          <td><a href="./p000958_d/fil/002.pdf">5月臨時会</a></td>
        </tr>
      </table>
    `;

    const result = parseYearPage(html, "/gikai/kaigiroku/p000958.html");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第1回 3月定例会",
      pdfUrl:
        "https://www.city.awara.lg.jp/gikai/kaigiroku/p000958_d/fil/001.pdf",
      meetingType: "plenary",
      pagePath: "/gikai/kaigiroku/p000958.html",
    });
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません。</p>";
    expect(parseYearPage(html, "/gikai/kaigiroku/p014488.html")).toEqual([]);
  });

  it("定例会・臨時会以外のリンクはスキップする", () => {
    const html = `
      <a href="./p014488_d/fil/document.pdf">添付資料</a>
      <a href="./p014488_d/fil/120kaigiroku.pdf">3月定例会</a>
    `;

    const result = parseYearPage(html, "/gikai/kaigiroku/p014488.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("3月定例会");
  });

  it("回次情報がない場合はリンクテキストのみをタイトルとする", () => {
    const html = `
      <a href="./p014488_d/fil/120kaigiroku.pdf">3月定例会</a>
    `;

    const result = parseYearPage(html, "/gikai/kaigiroku/p014488.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("3月定例会");
  });
});
