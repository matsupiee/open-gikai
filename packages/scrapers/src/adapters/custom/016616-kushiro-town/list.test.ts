import { describe, expect, it } from "vitest";
import {
  parseYearListPage,
  parseDetailPage,
  parseDateFromPdfTitle,
} from "./list";

describe("parseYearListPage", () => {
  it("定例会と臨時会のリンクを正しく分類する", () => {
    const html = `
      <html><body>
      <h2>令和6年に開催した定例会・臨時会</h2>
      <h3>定例会</h3>
      <table>
        <tr>
          <td>第1回定例会</td>
          <td><a href="../../gikai/gijiroku/1/1/2024.html">会議録</a></td>
        </tr>
        <tr>
          <td>第2回定例会</td>
          <td><a href="../../gikai/gijiroku/2/1/2024.html">会議録</a></td>
        </tr>
      </table>
      <h3>臨時会</h3>
      <table>
        <tr>
          <td>第1回臨時会</td>
          <td><a href="../../gikai/gijiroku/1/2/2024.html">会議録</a></td>
        </tr>
      </table>
      </body></html>
    `;

    const { detailUrls } = parseYearListPage(html);

    expect(detailUrls).toHaveLength(3);
    expect(detailUrls[0]!.category).toBe("plenary");
    expect(detailUrls[0]!.url).toBe(
      "http://www.town.kushiro.lg.jp/gikai/gijiroku/1/1/2024.html",
    );
    expect(detailUrls[1]!.category).toBe("plenary");
    expect(detailUrls[2]!.category).toBe("extraordinary");
    expect(detailUrls[2]!.url).toBe(
      "http://www.town.kushiro.lg.jp/gikai/gijiroku/1/2/2024.html",
    );
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <h3>定例会</h3>
      <a href="../../gikai/gijiroku/1/1/2024.html">会議録</a>
      <a href="../../gikai/gijiroku/1/1/2024.html">会議録</a>
    `;

    const { detailUrls } = parseYearListPage(html);
    expect(detailUrls).toHaveLength(1);
  });

  it("h3 がない場合は URL の種別（1=定例会, 2=臨時会）で分類する", () => {
    const html = `
      <a href="../../gikai/gijiroku/1/1/2024.html">会議録</a>
      <a href="../../gikai/gijiroku/1/2/2024.html">会議録</a>
    `;

    const { detailUrls } = parseYearListPage(html);
    expect(detailUrls).toHaveLength(2);
    expect(detailUrls[0]!.category).toBe("plenary");
    expect(detailUrls[1]!.category).toBe("extraordinary");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><h3>定例会</h3></body></html>`;
    const { detailUrls } = parseYearListPage(html);
    expect(detailUrls).toHaveLength(0);
  });
});

describe("parseDetailPage", () => {
  it("PDF リンクとメタ情報を抽出する", () => {
    const html = `
      <html><body>
      <h2>令和6年第1回釧路町議会定例会 会議録</h2>
      <table>
        <tr>
          <th>掲載内容</th>
          <th>会議録閲覧</th>
        </tr>
        <tr>
          <td>06.03.04（月）町政執行方針、教育行政執行方針、代表質問（3名）ほか</td>
          <td><a href="../../../../gikai/kaigiroku/2024/teirei_1/kaigi376.pdf">PDF</a></td>
        </tr>
        <tr>
          <td>06.03.05（火）代表質問（2名）、一般質問（6名）</td>
          <td><a href="../../../../gikai/kaigiroku/2024/teirei_1/kaigi377.pdf">PDF</a></td>
        </tr>
      </table>
      </body></html>
    `;

    const meetings = parseDetailPage(html, "plenary");

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.kushiro.lg.jp/gikai/kaigiroku/2024/teirei_1/kaigi376.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-03-04");
    expect(meetings[0]!.category).toBe("plenary");
    expect(meetings[0]!.pdfKey).toBe("016616_kaigi376");
    expect(meetings[0]!.title).toContain("令和6年第1回");
    expect(meetings[0]!.title).toContain("定例会");

    expect(meetings[1]!.pdfUrl).toBe(
      "http://www.town.kushiro.lg.jp/gikai/kaigiroku/2024/teirei_1/kaigi377.pdf",
    );
    expect(meetings[1]!.heldOn).toBe("2024-03-05");
    expect(meetings[1]!.pdfKey).toBe("016616_kaigi377");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>令和6年第1回釧路町議会定例会 会議録</h2>
      <table><tr><td>内容なし</td></tr></table>
    `;
    const meetings = parseDetailPage(html, "plenary");
    expect(meetings).toHaveLength(0);
  });

  it("臨時会として category を設定する", () => {
    const html = `
      <h2>令和6年第1回釧路町議会臨時会 会議録</h2>
      <table>
        <tr>
          <td>06.05.10（金）臨時会</td>
          <td><a href="../../../../gikai/kaigiroku/2024/rinji_1/kaigi400.pdf">PDF</a></td>
        </tr>
      </table>
    `;
    const meetings = parseDetailPage(html, "extraordinary");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("extraordinary");
  });
});

describe("parseDateFromPdfTitle", () => {
  it("令和の年月日（半角）をパースする", () => {
    expect(parseDateFromPdfTitle("令和6年3月4日（月曜日）")).toBe("2024-03-04");
  });

  it("令和の年月日（全角数字）をパースする", () => {
    expect(parseDateFromPdfTitle("令和６年３月４日（月曜日）")).toBe("2024-03-04");
  });

  it("令和元年をパースする", () => {
    expect(parseDateFromPdfTitle("令和元年6月3日")).toBe("2019-06-03");
  });

  it("平成の年月日をパースする", () => {
    expect(parseDateFromPdfTitle("平成25年3月5日")).toBe("2013-03-05");
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(parseDateFromPdfTitle("釧路町議会定例会会議録")).toBeNull();
  });
});
