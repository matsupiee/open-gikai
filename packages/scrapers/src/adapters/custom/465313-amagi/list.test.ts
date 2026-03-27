import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("対象年度の行から会議 PDF だけを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td colspan="2"><strong style="font-size:120%;">令和６年 議事録</strong></td>
        </tr>
        <tr>
          <td rowspan="5">第４回天城町定例会</td>
          <td><a class="icon-pdf" href="/fs/r6-4-mokuji.pdf">R6天城町4定 目次 (PDF 239KB)</a></td>
        </tr>
        <tr>
          <td><a class="icon-pdf" href="/fs/r6-4-schedule.pdf">R6天城町4定 会期日程 (PDF 76.1KB)</a></td>
        </tr>
        <tr>
          <td><a class="icon-pdf" href="/fs/r6-4-1.pdf">R6天城町4定(1号)12月5日 (PDF 1.05MB)</a></td>
        </tr>
        <tr>
          <td><a class="icon-pdf" href="/fs/r6-4-2.pdf">R6天城町4定(2号)12月6日 (PDF 1.04MB)</a></td>
        </tr>
        <tr>
          <td><a class="icon-pdf" href="/fs/r6-4-3.pdf">R6天城町4定(3号)12月9日 (PDF 970KB)</a></td>
        </tr>
        <tr>
          <td colspan="2"><strong style="font-size:120%;">令和５年 議事録</strong></td>
        </tr>
        <tr>
          <td rowspan="3">第２回天城町定例会</td>
          <td><a class="icon-pdf" href="/fs/r5-2-1.pdf">R5天城町2定(1号)6月6日.pdf (PDF 1.38MB)</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toBe("https://www.town.amagi.lg.jp/fs/r6-4-1.pdf");
    expect(meetings[0]!.title).toBe("第４回天城町定例会 1号 12月5日");
    expect(meetings[0]!.heldOn).toBe("2024-12-05");
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[2]!.pdfUrl).toBe("https://www.town.amagi.lg.jp/fs/r6-4-3.pdf");
    expect(meetings[2]!.heldOn).toBe("2024-12-09");
  });

  it("rowspan の会議名を後続行に引き継ぐ", () => {
    const html = `
      <table>
        <tr>
          <td colspan="2"><strong>令和７年 議事録</strong></td>
        </tr>
        <tr>
          <td rowspan="4">第３回天城町定例会</td>
          <td><a href="/fs/r7-3-mokuji.pdf">R7天城町3定 目次 (PDF 124KB)</a></td>
        </tr>
        <tr>
          <td><a href="/fs/r7-3-1.pdf">R7天城町3定(1号)9月9日 (PDF 1.07MB)</a></td>
        </tr>
        <tr>
          <td><a href="/fs/r7-3-2.pdf">R7天城町3定(2号)9月10日 (PDF 1.29MB)</a></td>
        </tr>
        <tr>
          <td><a href="/fs/r7-3-3.pdf">R7天城町3定(3号)9月11日 (PDF 695KB)</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.title).toBe("第３回天城町定例会 1号 9月9日");
    expect(meetings[1]!.title).toBe("第３回天城町定例会 2号 9月10日");
    expect(meetings[2]!.title).toBe("第３回天城町定例会 3号 9月11日");
  });

  it("平成の見出しも処理する", () => {
    const html = `
      <table>
        <tr>
          <td colspan="2"><strong>平成３０年 議事録</strong></td>
        </tr>
        <tr>
          <td rowspan="3">第4回天城町定例会</td>
          <td><a href="/fs/h30-4-1.pdf">12月18日.pdf (PDF 865KB)</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2018);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-12-18");
    expect(meetings[0]!.title).toBe("第4回天城町定例会 12月18日");
  });

  it("令和元年を正しく処理する", () => {
    const html = `
      <table>
        <tr>
          <td colspan="2"><strong>令和元年 議事録</strong></td>
        </tr>
        <tr>
          <td rowspan="3">第2回天城町定例会</td>
          <td><a href="/fs/r1-2-2.pdf">6月12日.pdf (PDF 869KB)</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-06-12");
    expect(meetings[0]!.title).toBe("第2回天城町定例会 6月12日");
  });
});
