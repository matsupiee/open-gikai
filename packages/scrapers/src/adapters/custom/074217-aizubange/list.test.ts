import { describe, expect, it } from "vitest";
import { parseDateText, parseListPage } from "./list";

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("令和7年", "3月6日（招集日）")).toBe("2025-03-06");
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年", "9月4日（招集日）")).toBe("2019-09-04");
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("平成元年", "4月1日")).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("令和7年", "資料一覧")).toBeNull();
  });
});

describe("parseListPage", () => {
  const baseUrl =
    "https://www.town.aizubange.fukushima.jp/site/gikai/9700.html";

  it("year と session の rowspan を引き継いで会議録を抽出する", () => {
    const html = `
      <table>
        <tr>
          <th>年号</th>
          <th>定例会・臨時会</th>
          <th>日にち</th>
          <th>会議録内容</th>
          <th>備考</th>
        </tr>
        <tr>
          <td rowspan="5">令和元年</td>
          <td rowspan="4">第3回定例会</td>
          <td>9月4日（招集日）</td>
          <td><a href="/uploaded/attachment/4837.pdf">9月4日（招集日） [PDFファイル／1.62MB]</a></td>
          <td>&nbsp;</td>
        </tr>
        <tr>
          <td>9月9日（一般質問1日目）</td>
          <td><a href="/uploaded/attachment/4841.pdf">9月9日（一般質問1日目） [PDFファイル／1.13MB]</a></td>
          <td>&nbsp;</td>
        </tr>
        <tr>
          <td>第2回臨時会</td>
          <td>11月5日</td>
          <td><a href="/uploaded/attachment/4844.pdf">11月5日（第2回臨時会） [PDFファイル／555KB]</a></td>
        </tr>
        <tr>
          <td rowspan="4"><p>令和 7年</p></td>
          <td rowspan="4"><p>第1回定例会</p></td>
          <td><p>3月6日（招集日）</p></td>
          <td><a href="/uploaded/attachment/9874.pdf">3月6日（招集日） [PDFファイル／617KB]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, baseUrl);

    expect(meetings).toHaveLength(4);
    expect(meetings[0]!.sessionName).toBe("第3回定例会");
    expect(meetings[0]!.heldOn).toBe("2019-09-04");
    expect(meetings[0]!.title).toBe("第3回定例会 9月4日（招集日）");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.aizubange.fukushima.jp/uploaded/attachment/4837.pdf",
    );

    expect(meetings[1]!.sessionName).toBe("第3回定例会");
    expect(meetings[1]!.heldOn).toBe("2019-09-09");

    expect(meetings[2]!.sessionName).toBe("第2回臨時会");
    expect(meetings[2]!.heldOn).toBe("2019-11-05");
    expect(meetings[2]!.title).toBe("第2回臨時会 11月5日");

    expect(meetings[3]!.sessionName).toBe("第1回定例会");
    expect(meetings[3]!.heldOn).toBe("2025-03-06");
  });

  it("壊れたリンクテキストでも日にち列から title と heldOn を作る", () => {
    const html = `
      <table>
        <tr>
          <td rowspan="1">令和 5年</td>
          <td rowspan="1">第4回定例会</td>
          <td>12月7日（招集日）</td>
          <td><a href="/uploaded/attachment/8719.pdf">12月7日（招集日 [PDFファイル／390KB]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, baseUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2023-12-07");
    expect(meetings[0]!.title).toBe("第4回定例会 12月7日（招集日）");
  });

  it("targetYear で対象年の会議録だけを返す", () => {
    const html = `
      <table>
        <tr>
          <td rowspan="1">令和 6年</td>
          <td rowspan="1">第1回定例会</td>
          <td>2月22日（招集日）</td>
          <td><a href="/uploaded/attachment/8933.pdf">2月22日（招集日） [PDFファイル／583KB]</a></td>
        </tr>
        <tr>
          <td rowspan="1">令和 8年</td>
          <td>第1回臨時会</td>
          <td>1月29日</td>
          <td><a href="/uploaded/attachment/10548.pdf">1月29日（第1回臨時会） [PDFファイル／12.04MB]</a></td>
        </tr>
      </table>
    `;

    const meetings2024 = parseListPage(html, baseUrl, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-02-22");

    const meetings2026 = parseListPage(html, baseUrl, 2026);
    expect(meetings2026).toHaveLength(1);
    expect(meetings2026[0]!.heldOn).toBe("2026-01-29");
    expect(meetings2026[0]!.sessionName).toBe("第1回臨時会");
  });
});
