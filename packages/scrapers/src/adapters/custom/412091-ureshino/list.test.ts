import { describe, expect, it } from "vitest";
import {
  parseTopPageYearLinks,
  parseYearPageSessionLinks,
  parseSessionPagePdfs,
} from "./list";
import { parseEraYear, buildDateStr } from "./shared";

describe("parseEraYear", () => {
  it("令和年度を変換する", () => {
    expect(parseEraYear("令和7年")).toBe(2025);
    expect(parseEraYear("令和6年")).toBe(2024);
    expect(parseEraYear("令和2年")).toBe(2020);
  });

  it("令和元年を変換する", () => {
    expect(parseEraYear("令和元年")).toBe(2019);
    expect(parseEraYear("令和元年・平成31年")).toBe(2019);
  });

  it("平成年度を変換する", () => {
    expect(parseEraYear("平成30年")).toBe(2018);
    expect(parseEraYear("平成18年")).toBe(2006);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseEraYear("2025年")).toBeNull();
    expect(parseEraYear("Unknown")).toBeNull();
    expect(parseEraYear("")).toBeNull();
  });
});

describe("buildDateStr", () => {
  it("月日文字列から日付を生成する", () => {
    expect(buildDateStr(2025, "2月28日")).toBe("2025-02-28");
    expect(buildDateStr(2025, "3月21日")).toBe("2025-03-21");
    expect(buildDateStr(2024, "6月9日")).toBe("2024-06-09");
    expect(buildDateStr(2024, "12月1日")).toBe("2024-12-01");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(buildDateStr(2025, "不明")).toBeNull();
    expect(buildDateStr(2025, "")).toBeNull();
  });
});

describe("parseTopPageYearLinks", () => {
  it("年度ページリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/gikai/hokoku/394/_32067.html">令和7年</a></li>
          <li><a href="/gikai/hokoku/394/_29726.html">令和6年</a></li>
          <li><a href="/gikai/hokoku/394/_24418.html">令和元年・平成31年</a></li>
          <li><a href="/gikai/hokoku/394/_24093.html">平成30年</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseTopPageYearLinks(html);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      year: 2025,
      url: "https://www.city.ureshino.lg.jp/gikai/hokoku/394/_32067.html",
    });
    expect(result[1]!.year).toBe(2024);
    expect(result[2]!.year).toBe(2019);
    expect(result[3]!.year).toBe(2018);
  });

  it("年度に対応しないリンクはスキップする", () => {
    const html = `
      <a href="/gikai/hokoku/394/_32067.html">令和7年</a>
      <a href="/gikai/about/_22645.html">議会改革</a>
      <a href="/gikai/_20285.html">映像配信</a>
    `;

    const result = parseTopPageYearLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
  });

  it("重複するURLを除外する", () => {
    const html = `
      <a href="/gikai/hokoku/394/_32067.html">令和7年</a>
      <a href="/gikai/hokoku/394/_32067.html">令和7年</a>
    `;

    const result = parseTopPageYearLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>リンクなし</p>";
    expect(parseTopPageYearLinks(html)).toEqual([]);
  });
});

describe("parseYearPageSessionLinks", () => {
  it("会議別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gikai/hokoku/394/_32067/_32074.html">令和7年第1回定例会</a></li>
        <li><a href="/gikai/hokoku/394/_32067/_32071.html">令和7年第2回定例会</a></li>
        <li><a href="/gikai/hokoku/394/_32067/_32243.html">令和７第１回臨時会</a></li>
      </ul>
    `;

    const result = parseYearPageSessionLinks(html, "/gikai/hokoku/394/_32067.html");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和7年第1回定例会",
      url: "https://www.city.ureshino.lg.jp/gikai/hokoku/394/_32067/_32074.html",
    });
    expect(result[1]!.title).toBe("令和7年第2回定例会");
    expect(result[2]!.title).toBe("令和７第１回臨時会");
  });

  it("他年度のリンクはスキップする", () => {
    const html = `
      <a href="/gikai/hokoku/394/_32067/_32074.html">令和7年第1回定例会</a>
      <a href="/gikai/hokoku/394/_29726/_29727.html">令和6年第1回定例会</a>
    `;

    const result = parseYearPageSessionLinks(html, "/gikai/hokoku/394/_32067.html");
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年第1回定例会");
  });

  it("重複するURLを除外する", () => {
    const html = `
      <a href="/gikai/hokoku/394/_32067/_32074.html">令和7年第1回定例会</a>
      <a href="/gikai/hokoku/394/_32067/_32074.html">令和7年第1回定例会</a>
    `;

    const result = parseYearPageSessionLinks(html, "/gikai/hokoku/394/_32067.html");
    expect(result).toHaveLength(1);
  });
});

describe("parseSessionPagePdfs", () => {
  it("会議録PDFレコードを抽出する", () => {
    const html = `
      <html>
      <body>
        <h1>令和7年第1回定例会</h1>
        <table>
          <tr>
            <th>日次</th><th>月日</th><th>開議時刻</th><th>区分</th><th>日程</th><th>会議録</th>
          </tr>
          <tr>
            <td>第1日</td>
            <td><p>2月28日(金)</p></td>
            <td>午前10時</td>
            <td>本会議</td>
            <td>開会、議案上程</td>
            <td>
              <p><a href="/var/rev0/0047/2590/12585154739.pdf">目次</a> (72KB; PDFファイル)</p>
              <p><a href="/var/rev0/0047/2591/12585154810.pdf">議決一覧表</a> (191KB; PDFファイル)</p>
              <p><a href="/var/rev0/0047/2592/1258610641.pdf">1日目会議録</a> (600KB; PDFファイル)</p>
            </td>
          </tr>
          <tr>
            <td>第2日</td>
            <td>3月1日(土)</td>
            <td></td>
            <td>休会</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>第11日</td>
            <td><p>3月10日(月）</p></td>
            <td>午前10時</td>
            <td>本会議</td>
            <td>議案質疑</td>
            <td>
              <p><a href="/var/rev0/0047/2593/1258610735.pdf">2日目会議録</a> (997KB; PDFファイル)</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const result = parseSessionPagePdfs(
      html,
      "令和7年第1回定例会",
      "/gikai/hokoku/394/_32067/_32074.html"
    );

    // 目次・議決一覧表は除外されるため2件のみ
    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和7年第1回定例会 1日目会議録");
    expect(result[0]!.heldOn).toBe("2025-02-28");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.ureshino.lg.jp/var/rev0/0047/2592/1258610641.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.sessionPagePath).toBe("/gikai/hokoku/394/_32067/_32074.html");

    expect(result[1]!.title).toBe("令和7年第1回定例会 2日目会議録");
    expect(result[1]!.heldOn).toBe("2025-03-10");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <table>
        <tr>
          <td>第1日</td>
          <td>4月1日(火)</td>
          <td>午前10時</td>
          <td>本会議</td>
          <td>開会</td>
          <td>
            <p><a href="/var/rev0/0047/9999/1234567890.pdf">会議録</a> (100KB; PDFファイル)</p>
          </td>
        </tr>
      </table>
    `;

    const result = parseSessionPagePdfs(
      html,
      "令和7第1回臨時会",
      "/gikai/hokoku/394/_32067/_32243.html"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2025-04-01");
  });

  it("PDFリンクがない行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <td>第1日</td>
          <td>4月1日(火)</td>
          <td></td>
          <td>休会</td>
          <td></td>
          <td></td>
        </tr>
      </table>
    `;

    const result = parseSessionPagePdfs(
      html,
      "令和7年第1回定例会",
      "/gikai/hokoku/394/_32067/_32074.html"
    );
    expect(result).toEqual([]);
  });

  it("目次・議決一覧表・会期日程を除外する", () => {
    const html = `
      <table>
        <tr>
          <td>第1日</td>
          <td>2月28日(金)</td>
          <td>午前10時</td>
          <td>本会議</td>
          <td>開会</td>
          <td>
            <p><a href="/var/rev0/0047/2590/111.pdf">目次</a></p>
            <p><a href="/var/rev0/0047/2591/222.pdf">議決一覧表</a></p>
            <p><a href="/var/rev0/0047/2592/333.pdf">会期日程・議決一覧</a></p>
            <p><a href="/var/rev0/0047/2593/444.pdf">議決一覧</a></p>
          </td>
        </tr>
      </table>
    `;

    const result = parseSessionPagePdfs(
      html,
      "令和7年第1回定例会",
      "/gikai/hokoku/394/_32067/_32074.html"
    );
    expect(result).toEqual([]);
  });

  it("セッションタイトルに年が含まれない場合は空配列を返す", () => {
    const html = `
      <table>
        <tr>
          <td>第1日</td>
          <td>4月1日(火)</td>
          <td></td>
          <td>本会議</td>
          <td></td>
          <td><a href="/var/rev0/0047/9999/1234.pdf">会議録</a></td>
        </tr>
      </table>
    `;

    const result = parseSessionPagePdfs(html, "第1回定例会", "/gikai/hokoku/394/_32067/_32074.html");
    expect(result).toEqual([]);
  });
});
